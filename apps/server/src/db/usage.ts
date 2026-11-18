import { monthKey, type QuotaKey } from "@dailify/shared";

/** Quota period key: the UTC calendar month (every quota is monthly, see `QuotaScope`). */
export function periodFor(at: Date): string {
  return monthKey(at.getUTCFullYear(), at.getUTCMonth());
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
