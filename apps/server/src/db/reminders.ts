import type { Task } from "@dailify/shared";
import { rowToTask, type TaskRow } from "./tasks";

/** A new token for the session replaces its old one. */
export async function saveReminderToken(
  db: D1Database,
  userId: string,
  sessionId: string,
  tokenHash: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO reminder_tokens (token_hash,user_id,session_id,created_at) VALUES (?,?,?,?)
       ON CONFLICT(session_id) DO UPDATE SET token_hash=excluded.token_hash,
         created_at=excluded.created_at`,
    )
    .bind(tokenHash, userId, sessionId, Date.now())
    .run();
}

export async function getReminderTokenUser(
  db: D1Database,
  tokenHash: string,
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT user_id FROM reminder_tokens WHERE token_hash=?`)
    .bind(tokenHash)
    .first<{ user_id: string }>();
  return row?.user_id ?? null;
}

/** Tasks that may have an alert in `[from, to]`: single ones in range, every live series. */
export async function listAlertTasks(
  db: D1Database,
  userId: string,
  from: number,
  to: number,
): Promise<Task[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM tasks WHERE user_id=? AND alert IS NOT NULL AND (
         (repeat_kind='Off' AND alert>=? AND alert<=?)
         OR (repeat_kind!='Off' AND (repeat_until IS NULL OR repeat_until + (alert - date) >= ?))
       )`,
    )
    .bind(userId, from, to, from)
    .all<TaskRow>();
  return results.map(rowToTask);
}
