import { Hono } from "hono";
import { PLAN_PERMISSIONS } from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { clerk, getUserRole, readStripeCustomerId, userEmail } from "../lib/clerk";
import { getPaymentDetails, isProductName, listInvoices, priceMap, stripeClient } from "../lib/stripe";
import { fail } from "../lib/errors";

const billing = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

billing.get("/permissions", requireAuth, async (c) =>
  c.json(PLAN_PERMISSIONS[await getUserRole(c.env, c.get("userId"))]),
);

billing.post("/billing/checkout", requireAuth, async (c) => {
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
  const user = await clerk(c.env).users.getUser(c.get("userId"));
  const stripeCustomerId = readStripeCustomerId(user);
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const details = await getPaymentDetails(c.env, stripeClient(c.env), stripeCustomerId);
  return c.json(details);
});

billing.get("/billing/invoices", requireAuth, async (c) => {
  const user = await clerk(c.env).users.getUser(c.get("userId"));
  const stripeCustomerId = readStripeCustomerId(user);
  if (!stripeCustomerId) return fail(c, 400, "No Stripe customer");

  const invoices = await listInvoices(c.env, stripeClient(c.env), stripeCustomerId);
  return c.json({ invoices });
});

export default billing;
