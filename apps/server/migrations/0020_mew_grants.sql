-- Mew reads from and sends to connected apps (bd Dailify-zpq.1). `read`/`send` rows in mew_actions
-- keep the provider and the provider-side address the server acts on; NULL for task proposals.
ALTER TABLE mew_actions ADD COLUMN provider TEXT;
ALTER TABLE mew_actions ADD COLUMN target TEXT;

-- "Sempre permitir": the Mew reads from this provider without asking. Revoked on the integrations
-- page or by disconnecting the provider.
CREATE TABLE mew_grants (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  capability TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, provider, capability)
);
