import { Hono } from "hono";
import type Stripe from "stripe";
import { PLAN_PERMISSIONS } from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { clerk, getUserRole, readStripeCustomerId, updateUserRole, userEmail } from "../lib/clerk";
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

const billing = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

billing.get("/permissions", requireAuth, async (c) =>
  c.json(PLAN_PERMISSIONS[await getUserRole(c.env, c.get("userId"))]),
);

billing.post("/billing/checkout", requireAuth, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return fail(c, 503, "Billing não configurado");
  const { productName } = await c.req.json<{ productName?: string }>();
  if (!productName || !isProductName(c.env, productName)) return fail(c, 400, "Unknown productName");

  const userId = c.get("userId");
  const user = await clerk(c.env).users.getUser(userId);
  const stripeCustomerId = readStripeCustomerId(user);
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
        return_url: `${c.env.ALLOWED_ORIGIN}/profile`,
      });
      return c.json({ url: portal.url });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceMap(c.env)[productName], quantity: 1 }],
    success_url: `${c.env.ALLOWED_ORIGIN}/sucesso`,
    cancel_url: `${c.env.ALLOWED_ORIGIN}/cancel`,
    customer_email: userEmail(user),
    subscription_data: { metadata: { clerkUserId: userId } },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
  return c.json({ url: session.url });
});

billing.get("/billing/portal", requireAuth, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return fail(c, 503, "Billing não configurado");
  const user = await clerk(c.env).users.getUser(c.get("userId"));
  const stripeCustomerId = readStripeCustomerId(user);
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const portal = await stripeClient(c.env).billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${c.env.ALLOWED_ORIGIN}/profile?tab=subscription`,
  });
  return c.json({ url: portal.url });
});

billing.get("/billing/payment-details", requireAuth, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json(null);
  const user = await clerk(c.env).users.getUser(c.get("userId"));
  const stripeCustomerId = readStripeCustomerId(user);
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const details = await getPaymentDetails(c.env, stripeClient(c.env), stripeCustomerId);
  return c.json(details);
});

billing.get("/billing/invoices", requireAuth, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.json([]);
  const user = await clerk(c.env).users.getUser(c.get("userId"));
  const stripeCustomerId = readStripeCustomerId(user);
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
    await handleInvoicePaid(c.env, stripe, event.data.object);
  } else if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const clerkUserId = sub.metadata.clerkUserId;
    if (typeof clerkUserId === "string") {
      await updateUserRole(c.env, { clerkUserId, role: "free", stripeCustomerId: customerId(sub.customer) });
    }
  } else if (event.type === "customer.subscription.updated") {
    const sub = event.data.object;
    const clerkUserId = sub.metadata.clerkUserId;
    const priceId = sub.items.data[0]?.price.id;
    if (typeof clerkUserId === "string" && priceId) {
      await updateUserRole(c.env, {
        clerkUserId,
        role: roleForPrice(c.env, priceId),
        stripeCustomerId: customerId(sub.customer),
      });
    }
  }

  return c.body(null, 200);
});

export default billing;
