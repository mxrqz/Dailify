import type { MewActionStatus, MewBlock } from "@dailify/shared";

/** One `mew_actions` row per confirm block, task ids only. */
export async function logProposals(
  db: D1Database,
  userId: string,
  blocks: MewBlock[],
  now: number,
): Promise<void> {
  const rows = blocks.flatMap((b) => (b.kind === "confirm" ? [b] : []));
  if (!rows.length) return;
  await db.batch(
    rows.map((b) =>
      db
        .prepare(
          `INSERT INTO mew_actions (id, user_id, action, task_ids, created_at) VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          b.id,
          userId,
          b.action,
          JSON.stringify([...new Set([...b.before, ...b.after].map((t) => t.id))]),
          now,
        ),
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
