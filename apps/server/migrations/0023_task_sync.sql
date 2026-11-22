-- Incremental sync (bd Dailify-1kz.1): `changed_at` is D1's clock at a row's last change, the
-- cursor of GET /tasks/sync. Not `updated_at`: that is the client's LWW stamp, and a queued offline
-- write lands carrying an old one. Triggers stamp it, so every write path (routes, Calendar sync,
-- duplicate merge) is covered without each statement remembering to. `alert_sent` is left out:
-- it isn't part of a Task. Existing rows start at their `updated_at`; every client begins with a
-- full pull anyway. The clock expression is `NOW_MS` in `src/db/tasks.ts`.
ALTER TABLE tasks ADD COLUMN changed_at INTEGER NOT NULL DEFAULT 0;
UPDATE tasks SET changed_at=updated_at;
CREATE INDEX idx_tasks_user_changed ON tasks(user_id, changed_at);

-- Deleted task ids for the pull, written by the delete trigger and swept after 90 days
-- (`sweepTombstones`). A re-created id drops its tombstone.
CREATE TABLE task_tombstones (
  user_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  deleted_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, task_id)
);

CREATE TRIGGER tasks_changed_insert AFTER INSERT ON tasks BEGIN
  UPDATE tasks SET changed_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=NEW.id;
  DELETE FROM task_tombstones WHERE user_id=NEW.user_id AND task_id=NEW.id;
END;

CREATE TRIGGER tasks_changed_update AFTER UPDATE OF title, date, alert, duration, priority, repeat_kind, repeat_days, repeat_every, repeat_until, tags, links, completed, updated_at, exdates, undated ON tasks BEGIN
  UPDATE tasks SET changed_at=CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) WHERE id=NEW.id;
END;

CREATE TRIGGER tasks_changed_delete AFTER DELETE ON tasks BEGIN
  INSERT OR REPLACE INTO task_tombstones (user_id, task_id, deleted_at)
  VALUES (OLD.user_id, OLD.id, CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
END;
