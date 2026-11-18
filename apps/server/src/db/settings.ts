import { DEFAULT_WEEK_START, isWeekStart, type WeekStart } from "@dailify/shared";

export interface UserSettings {
  weekStart: WeekStart;
  /** null = automático: vale o fuso do aparelho. */
  timeZone: string | null;
  hour12: boolean;
  /** The user agreed to send their agenda to OpenAI through the Mew chat. */
  mewConsent: boolean;
}

export async function getSettings(db: D1Database, userId: string): Promise<UserSettings> {
  const row = await db
    .prepare(
      `SELECT week_start, time_zone, hour12, mew_consent_at FROM user_settings WHERE user_id=?`,
    )
    .bind(userId)
    .first<{
      week_start: number;
      time_zone: string | null;
      hour12: number;
      mew_consent_at: number | null;
    }>();
  return {
    weekStart: isWeekStart(row?.week_start) ? row.week_start : DEFAULT_WEEK_START,
    timeZone: row?.time_zone ?? null,
    hour12: row?.hour12 === 1,
    mewConsent: row?.mew_consent_at != null,
  };
}

/** Grava só o que veio: mudar o fuso não pode apagar o início da semana. */
export async function saveSettings(
  db: D1Database,
  userId: string,
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  const next = { ...(await getSettings(db, userId)), ...patch };
  // COALESCE keeps the first consent time: saving the week start must not re-date it.
  await db
    .prepare(
      `INSERT INTO user_settings (user_id, week_start, time_zone, hour12, mew_consent_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET week_start=excluded.week_start,
         time_zone=excluded.time_zone, hour12=excluded.hour12,
         mew_consent_at=CASE WHEN excluded.mew_consent_at IS NULL THEN NULL
           ELSE COALESCE(user_settings.mew_consent_at, excluded.mew_consent_at) END`,
    )
    .bind(
      userId,
      next.weekStart,
      next.timeZone,
      next.hour12 ? 1 : 0,
      next.mewConsent ? Date.now() : null,
    )
    .run();
  return next;
}
