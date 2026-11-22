import {
  canUseIntegration,
  INTEGRATIONS,
  isProviderId,
  PROVIDER_IDS,
  TASK_LIMITS,
  type IntegrationLink,
  type ProviderId,
  type Role,
  type Task,
} from "@dailify/shared";
import { addExdatesStatement, getTask, insertStatement, rowToTask, type TaskRow } from "./tasks";

export interface ConnectionRow {
  provider: string;
  account_id: string;
  account_email: string | null;
  scopes: string;
  tokens: string;
  status: string;
  skipped: number;
}

export async function listConnections(db: D1Database, userId: string): Promise<ConnectionRow[]> {
  const { results } = await db
    .prepare(
      `SELECT provider, account_id, account_email, scopes, tokens, status, skipped
       FROM integration_connections WHERE user_id=?`,
    )
    .bind(userId)
    .all<ConnectionRow>();
  return results;
}

/** Active connections the plan unlocks: the apps the Mew may read from or send to. */
export async function activeIntegrations(
  db: D1Database,
  userId: string,
  role: Role,
): Promise<ProviderId[]> {
  const connections = await listConnections(db, userId);
  return PROVIDER_IDS.filter(
    (id) =>
      canUseIntegration(role, id) &&
      connections.some((r) => r.provider === id && r.status === "active"),
  );
}

/** The ones that take tasks: the only `targets` the AI may suggest. */
export const aiTargets = async (db: D1Database, userId: string, role: Role) =>
  (await activeIntegrations(db, userId, role)).filter((id) => INTEGRATIONS[id].tasks);

export async function getConnection(
  db: D1Database,
  userId: string,
  provider: ProviderId,
): Promise<ConnectionRow | null> {
  return db
    .prepare(
      `SELECT provider, account_id, account_email, scopes, tokens, status, skipped
       FROM integration_connections WHERE user_id=? AND provider=?`,
    )
    .bind(userId, provider)
    .first<ConnectionRow>();
}

/**
 * Reconectar com outra conta derruba os vínculos (os ids externos eram da conta antiga) e o
 * syncToken; as tarefas, inclusive as importadas, ficam como tarefas comuns.
 */
export async function upsertConnection(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  conn: { accountId: string; email: string | null; scopes: string; tokens: string },
  now: number,
): Promise<void> {
  await db.batch([
    db
      .prepare(
        `DELETE FROM integration_links WHERE user_id=?1 AND provider=?2 AND EXISTS (
           SELECT 1 FROM integration_connections
           WHERE user_id=?1 AND provider=?2 AND account_id<>?3)`,
      )
      .bind(userId, provider, conn.accountId),
    db
      .prepare(
        `INSERT INTO integration_connections
           (user_id, provider, account_id, account_email, scopes, tokens, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
         ON CONFLICT(user_id, provider) DO UPDATE SET account_id=excluded.account_id,
           account_email=excluded.account_email, scopes=excluded.scopes, tokens=excluded.tokens,
           status='active', updated_at=excluded.updated_at,
           sync_token=CASE WHEN account_id=excluded.account_id THEN sync_token END,
           tasks_synced_at=CASE WHEN account_id=excluded.account_id THEN tasks_synced_at END`,
      )
      .bind(userId, provider, conn.accountId, conn.email, conn.scopes, conn.tokens, now, now),
  ]);
}

export async function updateTokens(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  tokens: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE integration_connections SET tokens=?, updated_at=? WHERE user_id=? AND provider=?`,
    )
    .bind(tokens, now, userId, provider)
    .run();
}

export async function markRevoked(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE integration_connections SET status='revoked', updated_at=?
       WHERE user_id=? AND provider=?`,
    )
    .bind(now, userId, provider)
    .run();
}

export async function deleteConnection(
  db: D1Database,
  userId: string,
  provider: ProviderId,
): Promise<void> {
  await db.batch([
    db
      .prepare(`DELETE FROM integration_connections WHERE user_id=? AND provider=?`)
      .bind(userId, provider),
    db
      .prepare(`DELETE FROM integration_links WHERE user_id=? AND provider=?`)
      .bind(userId, provider),
    db.prepare(`DELETE FROM mew_grants WHERE user_id=? AND provider=?`).bind(userId, provider),
  ]);
}

export interface OAuthState {
  user_id: string;
  provider: string;
  code_verifier: string;
}

/** Grava o state novo e varre os vencidos — nada mais apaga state que ninguém consumiu. */
export async function insertState(
  db: D1Database,
  state: string,
  row: OAuthState,
  expiresAt: number,
  now: number,
): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM oauth_states WHERE expires_at<=?`).bind(now),
    db
      .prepare(
        `INSERT INTO oauth_states (state, user_id, provider, code_verifier, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(state, row.user_id, row.provider, row.code_verifier, expiresAt),
  ]);
}

/** Uso único e atômico: dois callbacks com o mesmo state não passam os dois. */
export async function consumeState(
  db: D1Database,
  state: string,
  now: number,
): Promise<OAuthState | null> {
  return db
    .prepare(
      `DELETE FROM oauth_states WHERE state=? AND expires_at>?
       RETURNING user_id, provider, code_verifier`,
    )
    .bind(state, now)
    .first<OAuthState>();
}

interface LinkRow {
  task_id: string;
  external_id: string;
  url: string | null;
}

const toLink = (provider: ProviderId, r: LinkRow): IntegrationLink => ({
  provider,
  taskId: r.task_id,
  externalId: r.external_id,
  url: r.url,
});

export async function getLink(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  taskId: string,
): Promise<IntegrationLink | null> {
  const row = await db
    .prepare(
      `SELECT task_id, external_id, url FROM integration_links
       WHERE user_id=? AND provider=? AND task_id=?`,
    )
    .bind(userId, provider, taskId)
    .first<LinkRow>();
  return row ? toLink(provider, row) : null;
}

/**
 * Upsert: duas confirmações simultâneas caem no mesmo evento (id determinístico), não em erro.
 * `remoteUpdated` = o `updated` do evento que a Mewki acabou de escrever (o sync o lê como eco).
 */
export async function upsertLink(
  db: D1Database,
  userId: string,
  link: IntegrationLink,
  timeZone: string,
  now: number,
  opts: { remoteUpdated?: number; readonly?: boolean } = {},
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO integration_links
         (user_id, provider, task_id, external_id, url, time_zone, updated_at, remote_updated, readonly)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, provider, task_id) DO UPDATE SET external_id=excluded.external_id,
         url=excluded.url, time_zone=excluded.time_zone, stale=0, updated_at=excluded.updated_at,
         remote_updated=excluded.remote_updated, readonly=excluded.readonly`,
    )
    .bind(
      userId,
      link.provider,
      link.taskId,
      link.externalId,
      link.url,
      timeZone,
      now,
      opts.remoteUpdated ?? null,
      opts.readonly ? 1 : 0,
    )
    .run();
}

export async function setRemoteUpdated(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  taskId: string,
  remoteUpdated: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE integration_links SET remote_updated=? WHERE user_id=? AND provider=? AND task_id=?`,
    )
    .bind(remoteUpdated, userId, provider, taskId)
    .run();
}

/** Os ids das instâncias da série `masterId` que viraram tarefa solta (`${masterId}_…`). */
export async function listInstanceIds(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  masterId: string,
): Promise<string[]> {
  const prefix = `${masterId}_`;
  const { results } = await db
    .prepare(
      `SELECT external_id FROM integration_links
       WHERE user_id=? AND provider=? AND substr(external_id, 1, ?)=?`,
    )
    .bind(userId, provider, prefix.length, prefix)
    .all<{ external_id: string }>();
  return results.map((r) => r.external_id);
}

/**
 * O vínculo como a propagação precisa: o fuso em que o evento foi montado, se ficou pra trás e se
 * é convite que só o organizador muda (`readonly`: nada de PATCH).
 */
export interface StoredLink extends IntegrationLink {
  timeZone: string | null;
  stale: boolean;
  readonly: boolean;
}

export async function listTaskLinks(
  db: D1Database,
  userId: string,
  taskId: string,
): Promise<StoredLink[]> {
  const { results } = await db
    .prepare(
      `SELECT provider, task_id, external_id, url, time_zone, stale, readonly
       FROM integration_links WHERE user_id=? AND task_id=?`,
    )
    .bind(userId, taskId)
    .all<
      LinkRow & { provider: string; time_zone: string | null; stale: number; readonly: number }
    >();
  return results.flatMap((r) =>
    isProviderId(r.provider)
      ? [
          {
            ...toLink(r.provider, r),
            timeZone: r.time_zone,
            stale: r.stale === 1,
            readonly: r.readonly === 1,
          },
        ]
      : [],
  );
}

/** Tarefas com vínculo `stale`, por provider: o "não sincronizado" do web. */
export async function listStale(
  db: D1Database,
  userId: string,
): Promise<{ provider: string; task_id: string }[]> {
  const { results } = await db
    .prepare(`SELECT provider, task_id FROM integration_links WHERE user_id=? AND stale=1`)
    .bind(userId)
    .all<{ provider: string; task_id: string }>();
  return results;
}

/** Importadas com uma tarefa própria parecida pendente: o web oferece juntar ou manter as duas. */
export async function listDuplicates(
  db: D1Database,
  userId: string,
): Promise<{ provider: string; task_id: string; duplicate_of: string }[]> {
  const { results } = await db
    .prepare(
      `SELECT provider, task_id, duplicate_of FROM integration_links
       WHERE user_id=? AND duplicate_of IS NOT NULL`,
    )
    .bind(userId)
    .all<{ provider: string; task_id: string; duplicate_of: string }>();
  return results;
}

/** Tarefas de convite: título, data e recorrência travados no web. */
export async function listReadonly(
  db: D1Database,
  userId: string,
): Promise<{ provider: string; task_id: string }[]> {
  const { results } = await db
    .prepare(`SELECT provider, task_id FROM integration_links WHERE user_id=? AND readonly=1`)
    .bind(userId)
    .all<{ provider: string; task_id: string }>();
  return results;
}

/** "Manter as duas": a importada segue sozinha. `false` = não havia par pendente. */
export async function keepDuplicate(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  importedId: string,
): Promise<boolean> {
  const { meta } = await db
    .prepare(
      `UPDATE integration_links SET duplicate_of=NULL
       WHERE user_id=? AND provider=? AND task_id=? AND duplicate_of IS NOT NULL`,
    )
    .bind(userId, provider, importedId)
    .run();
  return meta.changes > 0;
}

/**
 * "Juntar": a tarefa própria fica (id, histórico, prioridade, tags, alerta) e herda a agenda da
 * importada — título, horário, duração, recorrência, exdates somados e os links do evento —; o
 * vínculo passa pra ela e a importada sai. Num batch só, e nada no Google: o evento é o mesmo.
 * `null` = não havia par pendente (ou a própria sumiu / ganhou outro vínculo).
 */
export async function mergeDuplicate(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  importedId: string,
): Promise<Task | null> {
  const row = await db
    .prepare(
      `SELECT duplicate_of FROM integration_links
       WHERE user_id=? AND provider=? AND task_id=? AND duplicate_of IS NOT NULL`,
    )
    .bind(userId, provider, importedId)
    .first<{ duplicate_of: string }>();
  if (!row) return null;
  const [imported, own, taken] = await Promise.all([
    getTask(db, userId, importedId),
    getTask(db, userId, row.duplicate_of),
    getLink(db, userId, provider, row.duplicate_of),
  ]);
  if (!imported || !own || taken) return null;

  const added = (imported.links ?? []).filter((l) => !(own.links ?? []).includes(l));
  const links = [...(own.links ?? []).slice(0, TASK_LIMITS.linksMax - added.length), ...added];
  const merged: Task = {
    ...own,
    title: imported.title,
    date: imported.date,
    duration: imported.duration,
    undated: imported.undated,
    repeat: imported.repeat,
    repeatEvery: imported.repeatEvery,
    repeatUntil: imported.repeatUntil,
    links: links.length ? links : undefined,
    updatedAt: undefined,
  };
  const results = await db.batch<TaskRow>([
    insertStatement(db, userId, merged),
    addExdatesStatement(db, userId, own.id, imported.exdates ?? []),
    db
      .prepare(
        `UPDATE integration_links SET task_id=?, imported=0, duplicate_of=NULL
         WHERE user_id=? AND provider=? AND task_id=?`,
      )
      .bind(own.id, userId, provider, importedId),
    db.prepare(`DELETE FROM tasks WHERE user_id=? AND id=?`).bind(userId, importedId),
    db.prepare(`SELECT * FROM tasks WHERE user_id=? AND id=?`).bind(userId, own.id),
  ]);
  const r = results[4].results[0];
  return r ? rowToTask(r) : null;
}

/** `timeZone` só quando vem (o retry manda o fuso do aparelho); ausente mantém o gravado. */
export async function setLinkState(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  taskId: string,
  state: { stale: boolean; timeZone?: string },
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE integration_links SET stale=?, time_zone=COALESCE(?, time_zone), updated_at=?
       WHERE user_id=? AND provider=? AND task_id=?`,
    )
    .bind(state.stale ? 1 : 0, state.timeZone ?? null, now, userId, provider, taskId)
    .run();
}

export async function deleteLink(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  taskId: string,
): Promise<void> {
  await db
    .prepare(`DELETE FROM integration_links WHERE user_id=? AND provider=? AND task_id=?`)
    .bind(userId, provider, taskId)
    .run();
}

/**
 * A polled provider's throttle and lock, like `claimSync`: moves `synced_at` or answers null. Its
 * `sync_token` column holds the ETag of the last listing.
 */
export async function claimPoll(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  now: number,
  minGap: number,
): Promise<{ etag: string | null } | null> {
  const row = await db
    .prepare(
      `UPDATE integration_connections SET synced_at=?1
       WHERE user_id=?2 AND provider=?3 AND status='active' AND COALESCE(synced_at,0)<?4
       RETURNING sync_token`,
    )
    .bind(now, userId, provider, now - minGap)
    .first<{ sync_token: string | null }>();
  return row && { etag: row.sync_token };
}

export async function saveEtag(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  etag: string | null,
): Promise<void> {
  await db
    .prepare(`UPDATE integration_connections SET sync_token=? WHERE user_id=? AND provider=?`)
    .bind(etag, userId, provider)
    .run();
}

/** Every link of a provider; `done` = its task is completed or gone. */
export async function listProviderLinks(
  db: D1Database,
  userId: string,
  provider: ProviderId,
): Promise<{ taskId: string; externalId: string; done: boolean }[]> {
  const { results } = await db
    .prepare(
      `SELECT l.task_id, l.external_id, (t.id IS NULL OR json_array_length(
         CASE WHEN json_valid(t.completed) THEN t.completed ELSE '[]' END) > 0) AS done
       FROM integration_links l LEFT JOIN tasks t ON t.user_id=l.user_id AND t.id=l.task_id
       WHERE l.user_id=? AND l.provider=?`,
    )
    .bind(userId, provider)
    .all<{ task_id: string; external_id: string; done: number }>();
  return results.map((r) => ({ taskId: r.task_id, externalId: r.external_id, done: r.done === 1 }));
}
