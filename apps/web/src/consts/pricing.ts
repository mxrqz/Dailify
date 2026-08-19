/**
 * Preço de exibição dos planos pagos — fonte ÚNICA pra landing (`Pricing`) e `/premium`.
 *
 * Antes os valores eram digitados à mão nos dois lugares e já haviam dessincronizado: o
 * `/premium` mostrava anual/economia errados. Centralizar aqui garante que as duas telas
 * mostrem o mesmo número. Chaves são `Role` (`pro` / `pro+ai`).
 *
 * ponytail: strings hard-coded; o ideal é resolver do Stripe (mesma fonte da cobrança).
 * Trocar por um fetch quando os price ids forem fiados — por ora um lugar só já mata o drift.
 */
export type PlanPricing = {
  readonly monthly: string;
  readonly yearly: string;
  /** Economia do anual vs 12× o mensal (ambos ~2 meses grátis, −17%). */
  readonly yearlySavings: string;
};

export const PLAN_PRICING = {
  pro: { monthly: "R$ 9,90", yearly: "R$ 99,00", yearlySavings: "Economize R$ 19,80" },
  "pro+ai": { monthly: "R$ 19,90", yearly: "R$ 199,00", yearlySavings: "Economize R$ 39,80" },
} as const satisfies Record<"pro" | "pro+ai", PlanPricing>;

/** Os planos que aparecem numa tabela de preço. `admin` é papel interno, não é vendido. */
export type PlanRole = "free" | "pro" | "pro+ai";
