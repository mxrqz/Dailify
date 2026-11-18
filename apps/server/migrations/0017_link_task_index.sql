-- idx_tasks_user_updated (0006) was for an incremental pull that never shipped: no query filters or
-- sorts tasks by updated_at, yet every task write maintains it. Task reads by user fall back to
-- idx_tasks_user_date (checked with EXPLAIN QUERY PLAN).
DROP INDEX IF EXISTS idx_tasks_user_updated;

-- Links are looked up by (user_id, task_id): listTaskLinks on every task PATCH/DELETE and the
-- correlated NOT EXISTS in the Calendar sync's unlinked-tasks query. The PK starts with
-- (user_id, provider), so without this the lookup scans all of the user's links.
CREATE INDEX idx_integration_links_user_task ON integration_links(user_id, task_id);
