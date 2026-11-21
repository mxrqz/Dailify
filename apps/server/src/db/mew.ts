import {
  isProviderId,
  type MewActionStatus,
  type MewBlock,
  type MewCapability,
  type ProviderId,
} from "@dailify/shared";

/** One `mew_actions` row per box: task ids only, or the provider address for read/send. */
export async function logProposals(
  db: D1Database,
  userId: string,
  blocks: MewBlock[],
  now: number,
): Promise<void> {
  const rows = blocks.flatMap((b) => {
    if (b.kind === "confirm") {
      const ids = [...new Set([...b.before, ...b.after].map((t) => t.id))];
      return [[b.id, b.action, JSON.stringify(ids), null, null]];
    }
    if (b.kind === "permission") return [[b.id, b.capability, "[]", b.provider, b.target]];
    if (b.kind === "send") return [[b.id, "send", "[]", b.provider, b.target]];
    return [];
  });
  if (!rows.length) return;
  await db.batch(
    rows.map((r) =>
      db
        .prepare(
          `INSERT INTO mew_actions (id, user_id, action, task_ids, provider, target, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(r[0], userId, r[1], r[2], r[3], r[4], now),
    ),
  );
}

/** `false` = no such row for this user. */
export async function setActionStatus(
  db: D1Database,
  userId: string,
  id: string,
  status: MewActionStatus,
): Promise<boolean> {
  const { meta } = await db
    .prepare(`UPDATE mew_actions SET status=? WHERE id=? AND user_id=?`)
    .bind(status, id, userId)
    .run();
  return meta.changes > 0;
}

/**
 * Marks a pending read/send `done` once, so a replay can't read or send twice. `null` = not this
 * user's, not pending, or another kind. A failure after the claim sets it back to `proposed`.
 */
export async function claimAction(
  db: D1Database,
  userId: string,
  id: string,
  action: MewCapability | "send",
): Promise<{ provider: ProviderId; target: string } | null> {
  const row = await db
    .prepare(
      `UPDATE mew_actions SET status='done'
       WHERE id=? AND user_id=? AND action=? AND status='proposed' AND target IS NOT NULL
       RETURNING provider, target`,
    )
    .bind(id, userId, action)
    .first<{ provider: string | null; target: string }>();
  return row?.provider && isProviderId(row.provider)
    ? { provider: row.provider, target: row.target }
    : null;
}

export async function hasGrant(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  capability: MewCapability,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS ok FROM mew_grants WHERE user_id=? AND provider=? AND capability=?`)
    .bind(userId, provider, capability)
    .first();
  return row !== null;
}

export async function listGrants(
  db: D1Database,
  userId: string,
): Promise<{ provider: string; capability: string }[]> {
  const { results } = await db
    .prepare(`SELECT provider, capability FROM mew_grants WHERE user_id=?`)
    .bind(userId)
    .all<{ provider: string; capability: string }>();
  return results;
}

export async function saveGrant(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  capability: MewCapability,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO mew_grants (user_id, provider, capability, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
    )
    .bind(userId, provider, capability, now)
    .run();
}

export async function deleteGrant(
  db: D1Database,
  userId: string,
  provider: ProviderId,
  capability: MewCapability,
): Promise<void> {
  await db
    .prepare(`DELETE FROM mew_grants WHERE user_id=? AND provider=? AND capability=?`)
    .bind(userId, provider, capability)
    .run();
}
