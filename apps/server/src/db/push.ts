import type { Task } from "@dailify/shared";
import type { PushSubscriptionKeys } from "../lib/push";
import { rowToTask, type Row } from "./tasks";

export interface StoredSubscription extends PushSubscriptionKeys {
  userId: string;
  timezone: string;
}

/** Re-inscrever o mesmo device é UPSERT: o endpoint é a identidade da inscrição. */
export async function saveSubscription(
  db: D1Database,
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string; timezone: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO push_subscriptions (endpoint,user_id,p256dh,auth,timezone,created)
       VALUES (?,?,?,?,?,?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, p256dh=excluded.p256dh,
         auth=excluded.auth, timezone=excluded.timezone`,
    )
    .bind(sub.endpoint, userId, sub.p256dh, sub.auth, sub.timezone, Date.now())
    .run();
}

export async function deleteSubscription(
  db: D1Database,
  userId: string,
  endpoint: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?`)
    .bind(userId, endpoint)
    .run();
}

/** Inscrição que o push service recusou (404/410): o device sumiu, a linha não serve mais. */
export async function deleteSubscriptionByEndpoint(
  db: D1Database,
  endpoint: string,
): Promise<void> {
  await db.prepare(`DELETE FROM push_subscriptions WHERE endpoint=?`).bind(endpoint).run();
}

export async function subscriptionsOf(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) as n FROM push_subscriptions WHERE user_id=?`)
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

interface SubscriptionRow {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
  timezone: string;
}

export async function subscriptionsFor(
  db: D1Database,
  userIds: string[],
): Promise<Map<string, StoredSubscription[]>> {
  const byUser = new Map<string, StoredSubscription[]>();
  if (!userIds.length) return byUser;

  const { results } = await db
    .prepare(
      `SELECT endpoint,user_id,p256dh,auth,timezone FROM push_subscriptions
       WHERE user_id IN (${userIds.map(() => "?").join(",")})`,
    )
    .bind(...userIds)
    .all<SubscriptionRow>();

  for (const row of results) {
    const list = byUser.get(row.user_id) ?? [];
    list.push({
      endpoint: row.endpoint,
      p256dh: row.p256dh,
      auth: row.auth,
      userId: row.user_id,
      timezone: row.timezone,
    });
    byUser.set(row.user_id, list);
  }
  return byUser;
}

export interface DueAlert {
  id: string;
  userId: string;
  title: string;
  date: number;
  alert: number;
}

interface DueRow {
  id: string;
  user_id: string;
  title: string;
  date: number;
  alert: number;
}

/**
 * Alertas vencidos ainda não enviados. `graceMs` é o quanto para trás vale a pena avisar: um cron
 * que ficou parado não deve despejar lembretes de ontem.
 *
 * Só tarefas SEM recorrência: as séries têm um alerta por ocorrência e passam por
 * `recurringAlertCandidates` logo abaixo.
 */
export async function dueAlerts(
  db: D1Database,
  now: number,
  graceMs: number,
  limit = 200, // ponytail: teto por passada; com mais que isso o certo é uma fila (Queues)
): Promise<DueAlert[]> {
  const { results } = await db
    .prepare(
      `SELECT id,user_id,title,date,alert FROM tasks
       WHERE alert IS NOT NULL AND alert_sent IS NULL AND repeat_kind='Off'
         AND alert<=? AND alert>=?
       ORDER BY alert LIMIT ?`,
    )
    .bind(now, now - graceMs, limit)
    .all<DueRow>();

  return results.map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    date: r.date,
    alert: r.alert,
  }));
}

/**
 * Séries com alerta cujos donos têm ao menos um device inscrito — só esses podem receber push, e
 * é do device que sai o fuso (o Worker roda em UTC e não sabe onde o dia do usuário começa).
 *
 * `alert_sent` aqui guarda o INSTANTE DO ALERTA da última ocorrência avisada, não a hora do envio:
 * é o que impede tanto o reenvio quanto pular a ocorrência seguinte.
 */
export async function recurringAlertCandidates(
  db: D1Database,
  limit = 200, // ponytail: teto por passada; acima disso o certo é uma fila (Queues)
): Promise<RecurringCandidate[]> {
  const { results } = await db
    .prepare(
      `SELECT t.*, (
         SELECT p.timezone FROM push_subscriptions p WHERE p.user_id = t.user_id LIMIT 1
       ) AS timezone
       FROM tasks t
       WHERE t.alert IS NOT NULL AND t.repeat_kind != 'Off'
         AND EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = t.user_id)
       LIMIT ?`,
    )
    .bind(limit)
    .all<Row & { alert_sent: number | null; timezone: string | null }>();

  return results.map((r) => ({
    task: rowToTask(r),
    userId: r.user_id,
    alertSent: r.alert_sent,
    timeZone: r.timezone ?? "UTC",
  }));
}

export interface RecurringCandidate {
  task: Task;
  userId: string;
  alertSent: number | null;
  timeZone: string;
}

/** Marca até onde a série já foi avisada (o instante do alerta da ocorrência, não o do envio). */
export async function markOccurrenceAlerted(
  db: D1Database,
  id: string,
  alertAt: number,
): Promise<void> {
  await db.prepare(`UPDATE tasks SET alert_sent=? WHERE id=?`).bind(alertAt, id).run();
}

export async function markAlertsSent(db: D1Database, ids: string[], at: number): Promise<void> {
  if (!ids.length) return;
  await db
    .prepare(
      `UPDATE tasks SET alert_sent=? WHERE id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(at, ...ids)
    .run();
}
