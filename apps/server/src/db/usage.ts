import { QUOTAS, type QuotaKey } from "@dailify/shared";

/** Chave de período da quota: o mês-calendário local, ou 'all' pra quem nunca reinicia. */
export function periodFor(key: QuotaKey, at: Date): string {
  if (QUOTAS[key].scope === "lifetime") return "all";
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
}

export async function readStoredUsage(
  db: D1Database,
  userId: string,
  key: QuotaKey,
  period: string,
): Promise<number> {
  const row = await db
    .prepare(`SELECT count FROM usage WHERE user_id=? AND quota=? AND period=?`)
    .bind(userId, key, period)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function bumpStoredUsage(
  db: D1Database,
  userId: string,
  key: QuotaKey,
  period: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage (user_id, quota, period, count) VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id, quota, period) DO UPDATE SET count = count + 1`,
    )
    .bind(userId, key, period)
    .run();
}
