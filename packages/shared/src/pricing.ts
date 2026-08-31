import type { Permissions, Role, Entitlements } from "./types";

export const PLAN_PERMISSIONS: Record<Role, Permissions> = {
  free: { taskLimits: { monthly: 30, recurring: 0 }, features: { voiceCreation: false } },
  pro: { taskLimits: { monthly: 300, recurring: -1 }, features: { voiceCreation: false } },
  "pro+ai": { taskLimits: { monthly: -1, recurring: -1 }, features: { voiceCreation: true } },
  admin: { taskLimits: { monthly: -1, recurring: -1 }, features: { voiceCreation: true } },
};

/**
 * Derives feature entitlements from the server-provided permissions (capability-based — never the
 * plan name). `permissions === undefined` = not loaded yet: premium features default OFF (so they
 * don't flash), but task creation is NOT blocked (don't lock out a paying user mid-load).
 */
export function computeEntitlements(
  permissions: Permissions | undefined,
  tasksUsed: number,
): Entitlements {
  const monthlyLimit = permissions?.taskLimits?.monthly ?? -1;
  const recurringLimit = permissions?.taskLimits?.recurring ?? 0;
  const unlimited = monthlyLimit < 0;
  const remaining = unlimited ? Infinity : Math.max(0, monthlyLimit - tasksUsed);

  return {
    loading: permissions === undefined,
    voice: permissions?.features?.voiceCreation ?? false,
    recurrence: recurringLimit !== 0, // 0 = not allowed; -1 (unlimited) or >0 = allowed
    monthlyLimit,
    unlimited,
    tasksUsed,
    remaining,
    canCreateTask: unlimited || remaining > 0,
  };
}

/** Os planos que aparecem numa tabela de preço. `admin` é papel interno, não é vendido. */
export type PlanRole = "free" | "pro" | "pro+ai";

/**
 * Preço dos planos pagos, em CENTAVOS — a mesma unidade do Stripe, que é quem cobra de verdade.
 *
 * Era string formatada ("R$ 9,90") dentro do `apps/web`, o que impedia comparar com a cobrança:
 * ninguém podia checar se a vitrine ainda dizia a verdade. Aqui, em número e no `shared`, o
 * servidor (que tem a chave) confere contra a API do Stripe — `test/pricing-stripe.test.ts`.
 *
 * ponytail: continua sendo um valor digitado. O certo é ler do Stripe em runtime (bd Dailify-3ky);
 * enquanto não for, o teste é o que impede a mentira de passar despercebida.
 */
export const PLAN_PRICING = {
  pro: { monthly: 990, yearly: 9900 },
  "pro+ai": { monthly: 1990, yearly: 19900 },
} as const satisfies Record<"pro" | "pro+ai", { monthly: number; yearly: number }>;

export const PRICING_CURRENCY = "brl";

/** Centavos → "R$ 9,90". Um lugar só formata, então a vitrine inteira fala a mesma língua. */
export function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Quanto o anual economiza contra 12× o mensal, em centavos. Calculado, nunca digitado. */
export function yearlySavings(plan: { monthly: number; yearly: number }): number {
  return plan.monthly * 12 - plan.yearly;
}
