import {
  API_ERROR,
  limitsFor,
  type ApiErrorCode,
  QUOTA_ERRORS,
  QUOTA_KEYS,
  type QuotaKey,
  type QuotaLimits,
  type QuotaUsage,
  type Role,
} from "@dailify/shared";
import { bumpStoredUsage, periodFor, readStoredUsage } from "./usage";

/** Barra antes de qualquer chamada à OpenAI. Bloqueado (limite 0) e esgotado: sem crédito, 403/429. */
export async function aiQuota(
  db: D1Database,
  userId: string,
  plan: Role,
): Promise<{ status: 403 | 429; error: string; code: ApiErrorCode } | null> {
  const limits = limitsFor(plan);
  const error = await enforce(db, userId, limits, "ai");
  if (!error) return null;
  return limits.ai === 0
    ? { status: 403, error, code: API_ERROR.aiBlocked }
    : { status: 429, error, code: API_ERROR.aiExhausted };
}

/** Crédito só depois da IA responder dentro do contrato: falha, timeout ou lixo não custam nada. */
export const debitAi = (db: D1Database, userId: string) =>
  bumpStoredUsage(db, userId, "ai", periodFor(new Date()));

type Counter = (db: D1Database, userId: string) => Promise<number>;

/** Uma entrada por quota do registro — quota nova sem contador não compila. */
const COUNTERS: Record<QuotaKey, Counter> = {
  // Credit is anchored to NOW (the month the request was made), never to a month the client views.
  ai: (db, userId) => readStoredUsage(db, userId, "ai", periodFor(new Date())),
};

export async function enforce(
  db: D1Database,
  userId: string,
  limits: QuotaLimits,
  key: QuotaKey,
): Promise<string | null> {
  const limit = limits[key];
  if (limit < 0) return null; // ilimitado: nem vale a query
  const used = await COUNTERS[key](db, userId);
  return used >= limit ? QUOTA_ERRORS[key] : null;
}

export async function readAllUsage(db: D1Database, userId: string): Promise<QuotaUsage> {
  const entries = await Promise.all(
    QUOTA_KEYS.map(async (key) => [key, await COUNTERS[key](db, userId)] as const),
  );
  // Literal com todas as chaves, não Record<string, number>: sem "as", uma quota nova sem entrada
  // aqui não compila — o mesmo raciocínio do COUNTERS acima.
  const usage: QuotaUsage = { ai: 0 };
  for (const [key, used] of entries) usage[key] = used;
  return usage;
}
