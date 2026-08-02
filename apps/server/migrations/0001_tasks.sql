CREATE TABLE tasks (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  date INTEGER NOT NULL, alert INTEGER,
  duration TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0,
  repeat_kind TEXT NOT NULL DEFAULT 'Off', repeat_days TEXT,
  tags TEXT, completed TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX idx_tasks_user_repeat ON tasks(user_id, repeat_kind);
