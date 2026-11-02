import { DEFAULT_WEEK_START, isWeekStart, type WeekStart } from "@dailify/shared";

export interface UserSettings {
  weekStart: WeekStart;
  /** null = automático: vale o fuso do aparelho. */
  timeZone: string | null;
  hour12: boolean;
}

export async function getSettings(db: D1Database, userId: string): Promise<UserSettings> {
  const row = await db
    .prepare(`SELECT week_start, time_zone, hour12 FROM user_settings WHERE user_id=?`)
    .bind(userId)
    .first<{ week_start: number; time_zone: string | null; hour12: number }>();
  return {
    weekStart: isWeekStart(row?.week_start) ? row.week_start : DEFAULT_WEEK_START,
    timeZone: row?.time_zone ?? null,
    hour12: row?.hour12 === 1,
  };
}

/** Grava só o que veio: mudar o fuso não pode apagar o início da semana. */
export async function saveSettings(
  db: D1Database,
  userId: string,
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  const next = { ...(await getSettings(db, userId)), ...patch };
  await db
    .prepare(
      `INSERT INTO user_settings (user_id, week_start, time_zone, hour12) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET week_start=excluded.week_start,
         time_zone=excluded.time_zone, hour12=excluded.hour12`,
    )
    .bind(userId, next.weekStart, next.timeZone, next.hour12 ? 1 : 0)
    .run();
  return next;
}
