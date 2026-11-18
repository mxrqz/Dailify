import Stripe from "stripe";
import type { Invoice, PaymentDetails, Role } from "@dailify/shared";
import type { Env } from "../index";
import { updateUserRole } from "./user";

export const stripeClient = (env: Env): Stripe =>
  new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

const PRODUCT_NAMES = ["pro", "pro-year", "max", "max-year"] as const;
export type ProductName = (typeof PRODUCT_NAMES)[number];

const ROLE_BY_PRODUCT: Record<ProductName, Role> = {
  pro: "pro",
  "pro-year": "pro",
  max: "max",
  "max-year": "max",
};
const RECURRING_BY_PRODUCT: Record<ProductName, "year" | "month"> = {
  pro: "month",
  "pro-year": "year",
  max: "month",
  "max-year": "year",
};

export function priceMap(env: Env): Record<ProductName, string> {
  return {
    pro: env.STRIPE_PRICE_PRO,
    "pro-year": env.STRIPE_PRICE_PRO_YEAR,
    max: env.STRIPE_PRICE_MAX,
    "max-year": env.STRIPE_PRICE_MAX_YEAR,
  };
}

export function isProductName(env: Env, value: string): value is ProductName {
  return value in priceMap(env);
}

interface PriceInfo {
  role: Role;
  recurring: "year" | "month";
}

/** Reverse-lookup a price id back to its role/interval. Linear scan over 4 known prices. */
function priceInfo(env: Env, priceId: string): PriceInfo | undefined {
  const prices = priceMap(env);
  const name = PRODUCT_NAMES.find((n) => prices[n] === priceId);
  return name && { role: ROLE_BY_PRODUCT[name], recurring: RECURRING_BY_PRODUCT[name] };
}

export function customerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | undefined {
  if (customer === null) return undefined;
  return typeof customer === "string" ? customer : customer.id;
}

function subscriptionId(sub: string | Stripe.Subscription | undefined): string | undefined {
  if (sub === undefined) return undefined;
  return typeof sub === "string" ? sub : sub.id;
}

function priceIdOf(line: Stripe.InvoiceLineItem | undefined): string | undefined {
  const price = line?.pricing?.price_details?.price;
  if (price === undefined) return undefined;
  return typeof price === "string" ? price : price.id;
}

/**
 * The line billing the subscription's current price. After an upgrade/downgrade Stripe puts the
 * proration lines (priced at the OLD plan) first, so `lines[0]` is the wrong plan. `undefined` for
 * an invoice made only of prorations.
 */
function planLine(lines: Stripe.InvoiceLineItem[]): Stripe.InvoiceLineItem | undefined {
  return lines.find(
    (l) =>
      l.parent?.type === "subscription_item_details" &&
      !l.parent.subscription_item_details?.proration,
  );
}

function paymentMethodOf(
  pm: string | Stripe.PaymentMethod | null | undefined,
): Stripe.PaymentMethod | undefined {
  return pm && typeof pm !== "string" ? pm : undefined;
}

/** Narrows Stripe's forward-compatible `Invoice.Status` (which allows unknown future strings) to the DTO's closed set. */
type KnownInvoiceStatus = "draft" | "open" | "paid" | "uncollectible" | "void";
const KNOWN_INVOICE_STATUSES: readonly string[] = [
  "draft",
  "open",
  "paid",
  "uncollectible",
  "void",
];

function isKnownInvoiceStatus(status: string): status is KnownInvoiceStatus {
  return KNOWN_INVOICE_STATUSES.includes(status);
}

function knownInvoiceStatus(status: Stripe.Invoice.Status | null): KnownInvoiceStatus | null {
  return status !== null && isKnownInvoiceStatus(status) ? status : null;
}

/**
 * `invoice.paid`: grava o plano e o customer de quem pagou. A chave `clerkUserId` na metadata da
 * assinatura é histórica (gravada no checkout desde o Clerk) e segue sendo o id do usuário.
 */
export async function handleInvoicePaid(env: Env, invoice: Stripe.Invoice): Promise<void> {
  const userId = invoice.parent?.subscription_details?.metadata?.clerkUserId;
  const subId = subscriptionId(invoice.parent?.subscription_details?.subscription);
  // Sem linha de plano (fatura só de proration) ou preço desconhecido: não mexe no plano.
  const role = roleForPrice(env, priceIdOf(planLine(invoice.lines.data)) ?? "");
  if (typeof userId !== "string" || !subId || !role) return;

  await updateUserRole(env.DB, { userId, role, stripeCustomerId: customerId(invoice.customer) });
}

/**
 * Cancela o que o usuário apagado ainda tem ativo. A busca é por `metadata.clerkUserId` (o id do
 * usuário, gravado no checkout) e não pelo customer: conta importada do Clerk pode não ter o
 * `stripeCustomerId` gravado, e a metadata da assinatura é a trilha que sempre existe. Devolve
 * quantas cancelou.
 */
export async function cancelSubscriptionsOf(stripe: Stripe, clerkUserId: string): Promise<number> {
  const found = await stripe.subscriptions.search({
    query: `metadata['clerkUserId']:'${clerkUserId}'`,
    limit: 20,
  });
  const active = found.data.filter(
    (s) => s.status !== "canceled" && s.status !== "incomplete_expired",
  );

  for (const subscription of active) await stripe.subscriptions.cancel(subscription.id);
  return active.length;
}

/** Resolves the role for a price; `undefined` for a price we don't sell, so callers skip the write. */
export function roleForPrice(env: Env, priceId: string): Role | undefined {
  return priceInfo(env, priceId)?.role;
}

export async function getPaymentDetails(
  env: Env,
  stripe: Stripe,
  stripeCustomerId: string,
): Promise<PaymentDetails | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "active",
    limit: 1,
  });
  const subscription = subscriptions.data[0];
  if (!subscription) return null;

  const preview = await stripe.invoices.createPreview({
    customer: stripeCustomerId,
    subscription: subscription.id,
  });
  const line = planLine(preview.lines.data);
  if (!line) return null;

  return {
    amount: preview.amount_due,
    currency: preview.currency,
    start: line.period.start,
    recurring: priceInfo(env, priceIdOf(line) ?? "")?.recurring ?? "month",
  };
}

export async function listInvoices(
  env: Env,
  stripe: Stripe,
  stripeCustomerId: string,
): Promise<Invoice[]> {
  const invoices = await stripe.invoices.list({ customer: stripeCustomerId, limit: 10 });

  return Promise.all(
    invoices.data.map(async (invoice): Promise<Invoice> => {
      const subId = subscriptionId(invoice.parent?.subscription_details?.subscription);
      const subscription = subId
        ? await stripe.subscriptions.retrieve(subId, { expand: ["default_payment_method"] })
        : undefined;
      const paymentMethod = paymentMethodOf(subscription?.default_payment_method);
      const card = paymentMethod?.card;
      const priceId =
        priceIdOf(planLine(invoice.lines.data)) ?? subscription?.items.data[0]?.price.id;

      return {
        recurring: (priceId && priceInfo(env, priceId)?.recurring) || "month",
        brandName: card?.brand ?? undefined,
        cardLast4: card?.last4 ?? undefined,
        walletType: card?.wallet?.type,
        paymentMethodType: paymentMethod?.type,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        status: knownInvoiceStatus(invoice.status),
        created: invoice.created,
        hosted_invoice_url: invoice.hosted_invoice_url,
      };
    }),
  );
}
