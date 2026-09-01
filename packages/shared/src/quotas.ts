import type { Role } from "./types";

export type QuotaScope = "month" | "lifetime";

/**
 * A declaração única de toda quota do produto. Servidor, cliente, página de preços e medidor do
 * header leem daqui — antes cada um tinha a sua cópia, e a de venda já mentia.
 *
 * `-1` = ilimitado, `0` = bloqueado. `scope` diz contra o quê o uso é contado: `month` reinicia a
 * cada mês-calendário, `lifetime` nunca reinicia.
 */
export const QUOTAS = {
  tasks: { scope: "month", limits: { free: 30, pro: 300, "pro+ai": -1, admin: -1 } },
  recurring: { scope: "lifetime", limits: { free: 3, pro: 30, "pro+ai": -1, admin: -1 } },
  voice: { scope: "month", limits: { free: 3, pro: 5, "pro+ai": 200, admin: -1 } },
} as const satisfies Record<string, { scope: QuotaScope; limits: Record<Role, number> }>;

export type QuotaKey = keyof typeof QUOTAS;

export const QUOTA_KEYS: readonly QuotaKey[] = Object.keys(QUOTAS).filter(isQuotaKey);

function isQuotaKey(value: string): value is QuotaKey {
  return value in QUOTAS;
}

export type QuotaLimits = Record<QuotaKey, number>;
export type QuotaUsage = Record<QuotaKey, number>;

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
  const out: Partial<Record<QuotaKey, T>> = {};
  for (const key of QUOTA_KEYS) out[key] = pick(key);
  return fullRecord(out);
}

/** `QUOTA_KEYS` vem de `Object.keys(QUOTAS)`, então o loop acima preencheu todas as chaves. */
function fullRecord<T>(partial: Partial<Record<QuotaKey, T>>): Record<QuotaKey, T> {
  const out: Record<string, T> = {};
  for (const key of QUOTA_KEYS) {
    const value = partial[key];
    if (value === undefined) throw new Error(`quota sem valor: ${key}`);
    out[key] = value;
  }
  return out;
}
