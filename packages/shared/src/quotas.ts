import type { Role } from "./types";

// ponytail: só mensal desde que recorrência deixou de ser quota. Uma quota vitalícia volta como
// `"lifetime"` aqui e um período fixo ('all') em `periodFor` (apps/server/src/db/usage.ts).
export type QuotaScope = "month";

/**
 * A declaração única de toda quota do produto. Servidor, cliente, página de preços e medidor do
 * header leem daqui — antes cada um tinha a sua cópia, e a de venda já mentia.
 *
 * `-1` = ilimitado, `0` = bloqueado. `scope` diz contra o quê o uso é contado: `month` reinicia a
 * cada mês-calendário.
 */
export const QUOTAS = {
  tasks: { scope: "month", limits: { free: -1, pro: -1, max: -1, admin: -1 } },
  ai: { scope: "month", limits: { free: 30, pro: 300, max: 1000, admin: -1 } },
} as const satisfies Record<string, { scope: QuotaScope; limits: Record<Role, number> }>;

export type QuotaKey = keyof typeof QUOTAS;

export const QUOTA_KEYS: readonly QuotaKey[] = Object.keys(QUOTAS).filter(isQuotaKey);

function isQuotaKey(value: string): value is QuotaKey {
  return value in QUOTAS;
}

export type QuotaLimits = Record<QuotaKey, number>;
export type QuotaUsage = Record<QuotaKey, number>;

/** `GET /permissions`. */
export interface QuotaSnapshot {
  limits: QuotaLimits;
  usage: QuotaUsage;
}

/** The `error` of an exhausted quota's 403/429: the web compares it to tell it from a rate limit. */
export const QUOTA_ERRORS: Record<QuotaKey, string> = {
  tasks: "Monthly Tasks Limit Reached",
  ai: "AI Credits Limit Reached",
};

export interface QuotaState {
  limit: number;
  used: number;
  /** `Infinity` quando ilimitado. */
  remaining: number;
  unlimited: boolean;
  blocked: boolean;
  exhausted: boolean;
  /** `null` quando ilimitado: não existe fração de um teto que não existe. É o que a barra lê. */
  ratio: number | null;
}

export interface Quotas {
  loading: boolean;
  states: Record<QuotaKey, QuotaState>;
}

export function limitsFor(role: Role): QuotaLimits {
  return mapKeys((key) => QUOTAS[key].limits[role]);
}

export function quotaState(limit: number, used: number): QuotaState {
  const unlimited = limit < 0;
  const blocked = limit === 0;
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  return {
    limit,
    used,
    remaining,
    unlimited,
    blocked,
    exhausted: remaining === 0,
    // Bloqueado desenha cheio: "cheio" já significa "não pode mais", que é exatamente o caso.
    ratio: unlimited ? null : blocked ? 1 : Math.min(1, used / limit),
  };
}

/**
 * Enquanto os limites não chegaram do servidor tudo conta como ilimitado: a UI se esconde pelo
 * `loading`, e o caminho de criação NÃO pode bloquear quem está pagando só porque a resposta
 * atrasou.
 */
export function computeQuotas(
  limits: QuotaLimits | undefined,
  usage: QuotaUsage | undefined,
): Quotas {
  const loading = limits === undefined || usage === undefined;
  // ponytail: default único porque nenhum plano tem limite 0 hoje. Se algum voltar a ter, o default
  // de carregamento precisa voltar a ser por quota, senão a afordância pisca antes de sumir.
  return {
    loading,
    states: mapKeys((key) => quotaState(loading ? -1 : limits[key], loading ? 0 : usage[key])),
  };
}

function mapKeys<T>(pick: (key: QuotaKey) => T): Record<QuotaKey, T> {
  const out: Record<string, T> = {};
  for (const key of QUOTA_KEYS) out[key] = pick(key);
  return out;
}
