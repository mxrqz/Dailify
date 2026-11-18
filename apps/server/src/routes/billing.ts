import { Hono } from "hono";
import type Stripe from "stripe";
import { limitsFor, type Role } from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { billingProfile, updateUserRole } from "../lib/user";
import { readAllUsage } from "../db/limits";
import {
  customerId,
  getPaymentDetails,
  handleInvoicePaid,
  isProductName,
  listInvoices,
  priceMap,
  roleForPrice,
  stripeClient,
} from "../lib/stripe";
import { fail } from "../lib/errors";
import { returnBase } from "../lib/origin";

const billing = new Hono<{ Bindings: Env; Variables: { userId: string; plan: Role } }>();

/**
 * O mês vem do cliente porque quota de escopo mensal é contada contra o mês que ele está olhando —
 * a agenda de agosto tem as suas 30 vagas, setembro tem outras 30.
 */
function monthParam(value: string | undefined): Date {
  const match = value === undefined ? null : /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return new Date();
  return new Date(year, month - 1, 1);
}

billing.get("/permissions", requireAuth, async (c) => {
  const userId = c.get("userId");
  const at = monthParam(c.req.query("month"));
  return c.json({
    limits: limitsFor(c.get("plan")),
    usage: await readAllUsage(c.env.DB, userId, at),
  });
});

billing.post("/billing/checkout", requireAuth, rateLimit("API_LIMITER"), async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return fail(c, 503, "Billing não configurado");
  const { productName } = await c.req.json<{ productName?: string }>();
  if (!productName || !isProductName(c.env, productName))
    return fail(c, 400, "Unknown productName");

  const userId = c.get("userId");
  const { email, stripeCustomerId } = await billingProfile(c.env.DB, userId);
  const stripe = stripeClient(c.env);

  if (stripeCustomerId) {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "active",
      limit: 1,
    });
    if (subscriptions.data.length) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${returnBase(c.env, c.req.header("Origin"))}/billing`,
      });
      return c.json({ url: portal.url });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceMap(c.env)[productName], quantity: 1 }],
    success_url: `${returnBase(c.env, c.req.header("Origin"))}/billing?checkout=success`,
    cancel_url: `${returnBase(c.env, c.req.header("Origin"))}/billing?checkout=cancel`,
    // Quem já foi cliente (assinatura cancelada) volta no mesmo customer, não ganha um duplicado.
    ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: email }),
    subscription_data: { metadata: { clerkUserId: userId } },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
  return c.json({ url: session.url });
});

billing.get("/billing/portal", requireAuth, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return fail(c, 503, "Billing não configurado");
  const { stripeCustomerId } = await billingProfile(c.env.DB, c.get("userId"));
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const portal = await stripeClient(c.env).billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${returnBase(c.env, c.req.header("Origin"))}/billing`,
  });
  return c.json({ url: portal.url });
});

billing.get("/billing/payment-details", requireAuth, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json(null);
  const { stripeCustomerId } = await billingProfile(c.env.DB, c.get("userId"));
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const details = await getPaymentDetails(c.env, stripeClient(c.env), stripeCustomerId);
  return c.json(details);
});

billing.get("/billing/invoices", requireAuth, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json([]);
  const { stripeCustomerId } = await billingProfile(c.env.DB, c.get("userId"));
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const invoices = await listInvoices(c.env, stripeClient(c.env), stripeCustomerId);
  return c.json(invoices);
});

billing.post("/webhooks/stripe", async (c) => {
  const sig = c.req.header("stripe-signature");
  const raw = await c.req.text();
  if (!sig) return fail(c, 400, "Missing signature");

  const stripe = stripeClient(c.env);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return fail(c, 400, "Invalid signature");
  }

  if (event.type === "invoice.paid") {
    await handleInvoicePaid(c.env, event.data.object);
  } else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const clerkUserId = sub.metadata.clerkUserId;
    if (typeof clerkUserId === "string") {
      await updateUserRole(c.env.DB, {
        userId: clerkUserId,
        role: "free",
        stripeCustomerId: customerId(sub.customer),
      });
    }
  } else if (event.type === "customer.subscription.updated") {
    const sub = event.data.object;
    const clerkUserId = sub.metadata.clerkUserId;
    const role = roleForPrice(c.env, sub.items.data[0]?.price.id ?? "");
    if (typeof clerkUserId === "string" && role) {
      await updateUserRole(c.env.DB, {
        userId: clerkUserId,
        role,
        stripeCustomerId: customerId(sub.customer),
      });
    }
  }

  return c.body(null, 200);
});

export default billing;
