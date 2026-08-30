-- LWW: a escrita mais recente vence, e o pull incremental precisa de (user_id, updated_at).
-- DEFAULT 0 nas linhas antigas: qualquer edição vinda de um cliente ganha delas, que é o certo —
-- elas nunca foram carimbadas.
ALTER TABLE tasks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_tasks_user_updated ON tasks(user_id, updated_at);
