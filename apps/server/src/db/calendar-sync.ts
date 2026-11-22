import type { Task } from "@dailify/shared";
import { insertStatement, rowToTask, setExdatesStatement, type TaskRow } from "./tasks";

const P = "google-calendar";

/**
 * Throttle e lock numa escrita só: quem consegue mover o `synced_at` roda, quem chega dentro de
 * `minGap` (ou com a conexão revogada/ausente) recebe null. Devolve o syncToken guardado, os
 * scopes concedidos e o cursor do Google Tasks.
 */
export async function claimSync(
  db: D1Database,
  userId: string,
  now: number,
  minGap: number,
): Promise<{ syncToken: string | null; scopes: string; tasksSyncedAt: number | null } | null> {
  const row = await db
    .prepare(
      `UPDATE integration_connections SET synced_at=?1
       WHERE user_id=?2 AND provider=?3 AND status='active' AND COALESCE(synced_at,0)<?4
       RETURNING sync_token, scopes, tasks_synced_at`,
    )
    .bind(now, userId, P, now - minGap)
    .first<{ sync_token: string | null; scopes: string; tasks_synced_at: number | null }>();
  return (
    row && { syncToken: row.sync_token, scopes: row.scopes, tasksSyncedAt: row.tasks_synced_at }
  );
}

/** Saved only after a whole Tasks pass, so a failed one is pulled again. */
export async function saveTasksCursor(db: D1Database, userId: string, at: number): Promise<void> {
  await db
    .prepare(`UPDATE integration_connections SET tasks_synced_at=? WHERE user_id=? AND provider=?`)
    .bind(at, userId, P)
    .run();
}

/** `skipped`: o full recontou (`set`); o incremental soma ao que já estava (`add`). */
export async function saveSyncState(
  db: D1Database,
  userId: string,
  syncToken: string | null,
  skipped: { set: number } | { add: number },
): Promise<void> {
  const [set, add] = "set" in skipped ? [skipped.set, 0] : [null, skipped.add];
  await db
    .prepare(
      `UPDATE integration_connections SET sync_token=?, skipped=COALESCE(?, skipped)+?
       WHERE user_id=? AND provider=?`,
    )
    .bind(syncToken, set, add, userId, P)
    .run();
}

/** As conexões que o cron varre: as ativas que esperam há mais tempo. */
export async function listOldestSyncs(db: D1Database, limit: number): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT user_id FROM integration_connections WHERE provider=? AND status='active'
       ORDER BY COALESCE(synced_at,0) LIMIT ?`,
    )
    .bind(P, limit)
    .all<{ user_id: string }>();
  return results.map((r) => r.user_id);
}

export interface SyncLink {
  taskId: string;
  externalId: string;
  url: string | null;
  imported: boolean;
  remoteUpdated: number | null;
  readonly: boolean;
}

interface SyncRow {
  task_id: string;
  external_id: string;
  url: string | null;
  imported: number;
  remote_updated: number | null;
  readonly: number;
}

const toSyncLink = (r: SyncRow): SyncLink => ({
  taskId: r.task_id,
  externalId: r.external_id,
  url: r.url,
  imported: r.imported === 1,
  remoteUpdated: r.remote_updated,
  readonly: r.readonly === 1,
});

const LINK_COLS = "task_id, external_id, url, imported, remote_updated, readonly";

export async function getLinkByExternal(
  db: D1Database,
  userId: string,
  externalId: string,
): Promise<SyncLink | null> {
  const row = await db
    .prepare(
      `SELECT ${LINK_COLS} FROM integration_links
       WHERE user_id=? AND provider=? AND external_id=?`,
    )
    .bind(userId, P, externalId)
    .first<SyncRow>();
  return row && toSyncLink(row);
}

/** As instâncias da série que viraram tarefa solta: id `${master}_${data}`. `substr` e não LIKE: `_` é curinga. */
export async function listInstanceLinks(
  db: D1Database,
  userId: string,
  masterId: string,
): Promise<SyncLink[]> {
  const prefix = `${masterId}_`;
  const { results } = await db
    .prepare(
      `SELECT ${LINK_COLS} FROM integration_links
       WHERE user_id=? AND provider=? AND substr(external_id, 1, ?)=?`,
    )
    .bind(userId, P, prefix.length, prefix)
    .all<SyncRow>();
  return results.map(toSyncLink);
}

/** Tarefas sem nenhum vínculo: as candidatas a duplicata de uma importada. */
export async function listUnlinkedTasks(db: D1Database, userId: string): Promise<Task[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM tasks t WHERE t.user_id=? AND NOT EXISTS (
         SELECT 1 FROM integration_links l WHERE l.user_id=t.user_id AND l.task_id=t.id)`,
    )
    .bind(userId)
    .all<TaskRow>();
  return results.map(rowToTask);
}

export interface LinkWrite {
  taskId: string;
  externalId: string;
  url: string;
  timeZone: string;
  imported: boolean;
  readonly: boolean;
  remoteUpdated: number;
  duplicateOf?: string;
}

/** Upsert pela tarefa: re-linkar (mewkiTaskId) troca o evento de uma tarefa que já teve vínculo. */
export function linkStatement(
  db: D1Database,
  userId: string,
  l: LinkWrite,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO integration_links (user_id, provider, task_id, external_id, url, time_zone,
         updated_at, imported, remote_updated, readonly, duplicate_of)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, provider, task_id) DO UPDATE SET external_id=excluded.external_id,
         url=excluded.url, time_zone=excluded.time_zone, updated_at=excluded.updated_at,
         imported=excluded.imported, remote_updated=excluded.remote_updated,
         readonly=excluded.readonly, stale=0`,
    )
    .bind(
      userId,
      P,
      l.taskId,
      l.externalId,
      l.url,
      l.timeZone,
      now,
      l.imported ? 1 : 0,
      l.remoteUpdated,
      l.readonly ? 1 : 0,
      l.duplicateOf ?? null,
    );
}

/** O dia inteiro importado vira Sem data com lembrete 09:00 só como âncora: não é push. */
const alertSentStatement = (db: D1Database, userId: string, taskId: string) =>
  db
    .prepare(`UPDATE tasks SET alert_sent=alert WHERE user_id=? AND id=? AND undated=1`)
    .bind(userId, taskId);

/** Tarefa + vínculo num batch: sem isso uma falha no meio deixa tarefa órfã que o sync reimporta. */
export async function importTask(
  db: D1Database,
  userId: string,
  task: Task,
  link: LinkWrite,
  now: number,
): Promise<void> {
  await db.batch([
    insertStatement(db, userId, task),
    linkStatement(db, userId, link, now),
    alertSentStatement(db, userId, task.id),
    // O insert não escreve `exdates` (só o servidor escreve, por esta via).
    ...(task.exdates?.length ? [setExdatesStatement(db, userId, task.id, task.exdates)] : []),
  ]);
}

export async function setRemoteState(
  db: D1Database,
  userId: string,
  taskId: string,
  state: { remoteUpdated: number; readonly: boolean; silenceAlert: boolean },
): Promise<void> {
  const update = db
    .prepare(
      `UPDATE integration_links SET remote_updated=?, readonly=?
       WHERE user_id=? AND provider=? AND task_id=?`,
    )
    .bind(state.remoteUpdated, state.readonly ? 1 : 0, userId, P, taskId);
  await db.batch(state.silenceAlert ? [update, alertSentStatement(db, userId, taskId)] : [update]);
}

/** Tarefa e vínculo saem juntos (evento importado/vinculado apagado no Google). */
export async function dropTasks(db: D1Database, userId: string, taskIds: string[]): Promise<void> {
  if (!taskIds.length) return;
  await db.batch(
    taskIds.flatMap((id) => [
      db.prepare(`DELETE FROM tasks WHERE user_id=? AND id=?`).bind(userId, id),
      db
        .prepare(`DELETE FROM integration_links WHERE user_id=? AND provider=? AND task_id=?`)
        .bind(userId, P, id),
    ]),
  );
}
