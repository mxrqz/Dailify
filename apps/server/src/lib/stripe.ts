import Stripe from "stripe";
import type { Env } from "../index";

export const stripeClient = (env: Env): Stripe =>
  new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

const PRODUCT_NAMES = ["pro", "pro-year", "pro+ai", "pro+ai-year"] as const;
export type ProductName = (typeof PRODUCT_NAMES)[number];

export function priceMap(env: Env): Record<ProductName, string> {
  return {
    pro: env.STRIPE_PRICE_PRO,
    "pro-year": env.STRIPE_PRICE_PRO_YEAR,
    "pro+ai": env.STRIPE_PRICE_PROAI,
    "pro+ai-year": env.STRIPE_PRICE_PROAI_YEAR,
  };
}

export function isProductName(env: Env, value: string): value is ProductName {
  return value in priceMap(env);
}
