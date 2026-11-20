import { Hono } from "hono";
import type Stripe from "stripe";
import { isRecord, limitsFor, type QuotaSnapshot } from "@dailify/shared";
import type { AppEnv } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { billingProfile } from "../db/user";
import { readAllUsage } from "../db/limits";
import {
  activeSubscription,
  getPaymentDetails,
  handleStripeEvent,
  isProductName,
  listInvoices,
  priceMap,
  stripeClient,
} from "../lib/stripe";
import { fail } from "../lib/errors";
import { readJson } from "../lib/task-input";
import { returnBase } from "../lib/origin";

const billing = new Hono<AppEnv>();
// /webhooks/stripe stays public (signature-checked).
billing.use("/billing/*", requireAuth, rateLimit("API_LIMITER"));
billing.use("/permissions", requireAuth, rateLimit("API_LIMITER"));

billing.get("/permissions", async (c) => {
  return c.json({
    limits: limitsFor(c.get("plan")),
    usage: await readAllUsage(c.env.DB, c.get("userId")),
  } satisfies QuotaSnapshot);
});

billing.post("/billing/checkout", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return fail(c, 503, "Billing not configured");
  const body = await readJson(c);
  const productName = isRecord(body) ? body.productName : undefined;
  if (!isProductName(productName)) return fail(c, 400, "Unknown productName");

  const userId = c.get("userId");
  const { email, stripeCustomerId } = await billingProfile(c.env.DB, userId);
  const stripe = stripeClient(c.env);
  const base = returnBase(c.env, c.req.header("Origin"));

  if (stripeCustomerId && (await activeSubscription(stripe, stripeCustomerId))) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${base}/billing`,
    });
    return c.json({ url: portal.url });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceMap(c.env)[productName], quantity: 1 }],
    success_url: `${base}/billing?checkout=success`,
    cancel_url: `${base}/billing?checkout=cancel`,
    // Quem já foi cliente (assinatura cancelada) volta no mesmo customer, não ganha um duplicado.
    ...(stripeCustomerId ? { customer: stripeCustomerId } : { customer_email: email }),
    subscription_data: { metadata: { clerkUserId: userId } },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
  return c.json({ url: session.url });
});

billing.get("/billing/portal", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return fail(c, 503, "Billing not configured");
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

billing.post("/webhooks/stripe", async (c) => {
  const sig = c.req.header("stripe-signature");
  const raw = await c.req.text();
  if (!sig) return fail(c, 400, "Missing signature");

  let event: Stripe.Event;
  try {
    event = await stripeClient(c.env).webhooks.constructEventAsync(
      raw,
      sig,
      c.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return fail(c, 400, "Invalid signature");
  }

  await handleStripeEvent(c.env, event);
  return c.body(null, 200);
});

export default billing;
