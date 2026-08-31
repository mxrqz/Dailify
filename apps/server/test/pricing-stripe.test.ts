import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { PLAN_PRICING, PRICING_CURRENCY, yearlySavings } from "@dailify/shared";

/**
 * O preço que a vitrine anuncia (`PLAN_PRICING`) contra o preço que o Stripe cobra.
 *
 * São duas verdades separadas: o número em `@dailify/shared` e o `unit_amount` do price id. Mudar
 * um no dashboard do Stripe não muda o outro, e a landing passa a mentir sem que nada quebre —
 * este teste é o que transforma esse silêncio em vermelho.
 *
 * Pula sozinho sem credenciais reais (CI, clone limpo): `vitest.config.ts` só injeta as bindings
 * `LIVE_*` quando elas existem no ambiente. Roda antes de mexer em preço, e antes de publicar.
 */
const PRICES = [
  { role: "pro", cycle: "monthly", binding: env.LIVE_PRICE_PRO, interval: "month" },
  { role: "pro", cycle: "yearly", binding: env.LIVE_PRICE_PRO_YEAR, interval: "year" },
  { role: "pro+ai", cycle: "monthly", binding: env.LIVE_PRICE_PROAI, interval: "month" },
  { role: "pro+ai", cycle: "yearly", binding: env.LIVE_PRICE_PROAI_YEAR, interval: "year" },
] as const;

interface StripePrice {
  unit_amount: number | null;
  currency: string;
  active: boolean;
  recurring: { interval: string } | null;
}

async function fetchPrice(id: string): Promise<StripePrice> {
  const res = await fetch(`https://api.stripe.com/v1/prices/${id}`, {
    headers: { Authorization: `Bearer ${env.LIVE_STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) throw new Error(`Stripe respondeu ${res.status} para o price ${id}`);
  return res.json<StripePrice>();
}

describe.skipIf(!env.LIVE_STRIPE_SECRET_KEY)("preço anunciado x preço cobrado", () => {
  for (const { role, cycle, binding, interval } of PRICES) {
    it(`${role} ${cycle}: PLAN_PRICING bate com o price id do Stripe`, async () => {
      const price = await fetchPrice(binding ?? "");

      expect(price.unit_amount).toBe(PLAN_PRICING[role][cycle]);
      expect(price.currency).toBe(PRICING_CURRENCY);
      expect(price.recurring?.interval).toBe(interval);
      // Price arquivado ainda responde no GET, mas o checkout com ele falha.
      expect(price.active).toBe(true);
    });
  }
});

/** Não precisa de rede: a economia anunciada é conta, não número digitado. */
describe("coerência interna do preço", () => {
  it("o anual custa menos que 12x o mensal nos dois planos pagos", () => {
    expect(yearlySavings(PLAN_PRICING.pro)).toBeGreaterThan(0);
    expect(yearlySavings(PLAN_PRICING["pro+ai"])).toBeGreaterThan(0);
  });

  it("a economia é de dois meses, que é o que a landing promete", () => {
    for (const role of ["pro", "pro+ai"] as const) {
      expect(yearlySavings(PLAN_PRICING[role])).toBe(PLAN_PRICING[role].monthly * 2);
    }
  });

  it("preços em centavos inteiros — a unidade do Stripe", () => {
    for (const plan of Object.values(PLAN_PRICING)) {
      expect(Number.isInteger(plan.monthly)).toBe(true);
      expect(Number.isInteger(plan.yearly)).toBe(true);
    }
  });
});
