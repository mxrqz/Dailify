import type { IntegrationLink, ProviderId } from "@dailify/shared";

export interface ConnectionRow {
  provider: string;
  account_id: string;
  account_email: string | null;
  scopes: string;
  tokens: string;
  status: string;
}

export async function listConnections(db: D1Database, userId: string): Promise<ConnectionRow[]> {
  const { results } = await db
    .prepare(
      `SELECT provider, account_id, account_email, scopes, tokens, status
       FROM integration_connections WHERE user_id=?`,
    )
    .bind(userId)
    .all<ConnectionRow>();
  return results;
}

export async function getConnection(
  db: D1Database,
  userId: string,
  provider: ProviderId,
): Promise<ConnectionRow | null> {
  return db
    .prepare(
      `SELECT provider, account_id, account_email, scopes, tokens, status
       FROM integration_connections WHERE user_id=? AND provider=?`,
    )
    .bind(userId, provider)
    .first<ConnectionRow>();
}

/** Reconectar com outra conta derruba os vínculos: os ids externos eram da conta antiga. */
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
           status='active', updated_at=excluded.updated_at`,
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

/** Upsert: duas confirmações simultâneas caem no mesmo evento (id determinístico), não em erro. */
export async function upsertLink(
  db: D1Database,
  userId: string,
  link: IntegrationLink,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO integration_links (user_id, provider, task_id, external_id, url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, provider, task_id) DO UPDATE SET external_id=excluded.external_id,
         url=excluded.url, updated_at=excluded.updated_at`,
    )
    .bind(userId, link.provider, link.taskId, link.externalId, link.url, now)
    .run();
}
