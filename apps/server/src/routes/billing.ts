import { Hono } from "hono";
import type Stripe from "stripe";
import { isRecord, limitsFor, type QuotaSnapshot } from "@dailify/shared";
import type { AppEnv } from "../index";
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
import { parseMonth, readJson } from "../lib/task-input";
import { returnBase } from "../lib/origin";

const billing = new Hono<AppEnv>();
// /webhooks/stripe stays public (signature-checked).
billing.use("/billing/*", requireAuth, rateLimit("API_LIMITER"));
billing.use("/permissions", requireAuth, rateLimit("API_LIMITER"));

billing.get("/permissions", async (c) => {
  const userId = c.get("userId");
  // The client sends the month it is viewing: a monthly quota is counted against that month.
  const at = parseMonth(c.req.query("month")) ?? new Date();
  return c.json({
    limits: limitsFor(c.get("plan")),
    usage: await readAllUsage(c.env.DB, userId, at),
  } satisfies QuotaSnapshot);
});

billing.post("/billing/checkout", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return fail(c, 503, "Billing não configurado");
  const body = await readJson(c);
  const productName = isRecord(body) ? body.productName : undefined;
  if (typeof productName !== "string" || !isProductName(c.env, productName))
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

billing.get("/billing/portal", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return fail(c, 503, "Billing não configurado");
  const { stripeCustomerId } = await billingProfile(c.env.DB, c.get("userId"));
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const portal = await stripeClient(c.env).billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${returnBase(c.env, c.req.header("Origin"))}/billing`,
  });
  return c.json({ url: portal.url });
});

billing.get("/billing/payment-details", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json(null);
  const { stripeCustomerId } = await billingProfile(c.env.DB, c.get("userId"));
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const details = await getPaymentDetails(c.env, stripeClient(c.env), stripeCustomerId);
  return c.json(details);
});

billing.get("/billing/invoices", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json([]);
  const { stripeCustomerId } = await billingProfile(c.env.DB, c.get("userId"));
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const invoices = await listInvoices(c.env, stripeClient(c.env), stripeCustomerId);
  return c.json(invoices);
});

const PAYING = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due"]);

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
  } else if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object;
    const clerkUserId = sub.metadata.clerkUserId;
    // Stripe doesn't order events, so a stale `updated` can land after `deleted`: the plan follows
    // the subscription as it is now, and only a paying status keeps a paid role.
    const current = await stripe.subscriptions.retrieve(sub.id);
    const role = PAYING.has(current.status)
      ? roleForPrice(c.env, current.items.data[0]?.price.id ?? "")
      : "free";
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
