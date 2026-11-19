-- Read-only tokens for the Android app's background reminder sync (bd Dailify-r2nz): its worker runs
-- without the WebView, so it can't use the session bearer. One per login session: signing out
-- deletes the Better Auth session row and, by cascade, its token. New table, no existing rows.
CREATE TABLE reminder_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE REFERENCES "session" ("id") ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);
