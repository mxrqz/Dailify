-- Mew chat. NULL = no consent yet: /mew/chat answers 403 until the user opts in (LGPD).
ALTER TABLE user_settings ADD COLUMN mew_consent_at INTEGER;

-- One row per proposal Mew made. Task ids only, never titles (LGPD).
CREATE TABLE mew_actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  task_ids TEXT NOT NULL, -- JSON array
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at INTEGER NOT NULL
);
CREATE INDEX mew_actions_user ON mew_actions (user_id);
