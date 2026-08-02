import Stripe from "stripe";
import type { Env } from "../index";

export const stripeClient = (env: Env): Stripe =>
  new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
