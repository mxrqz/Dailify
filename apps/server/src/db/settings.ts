import { DEFAULT_WEEK_START, isWeekStart, type WeekStart } from "@dailify/shared";

export async function getWeekStart(db: D1Database, userId: string): Promise<WeekStart> {
  const row = await db
    .prepare(`SELECT week_start FROM user_settings WHERE user_id=?`)
    .bind(userId)
    .first<{ week_start: number }>();
  return isWeekStart(row?.week_start) ? row.week_start : DEFAULT_WEEK_START;
}

export async function setWeekStart(
  db: D1Database,
  userId: string,
  weekStart: WeekStart,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO user_settings (user_id, week_start) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET week_start=excluded.week_start`,
    )
    .bind(userId, weekStart)
    .run();
}
