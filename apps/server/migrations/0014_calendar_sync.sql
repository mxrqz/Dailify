-- Sync da Agenda: eventos do Google viram tarefas. `repeat_until` = fim da série (UNTIL; NULL =
-- sem fim). No link: `imported` = a tarefa nasceu do Google, `remote_updated` = o `updated` do
-- evento já aplicado (eco), `readonly` = convite que só o organizador muda, `duplicate_of` = tarefa
-- própria que parece ser esta (NULL = nada pendente). Na conexão: o syncToken incremental, a hora
-- do último sync (throttle e lock) e quantos eventos ficaram só na Agenda.
ALTER TABLE tasks ADD COLUMN repeat_until INTEGER;
ALTER TABLE integration_links ADD COLUMN imported INTEGER NOT NULL DEFAULT 0;
ALTER TABLE integration_links ADD COLUMN remote_updated INTEGER;
ALTER TABLE integration_links ADD COLUMN readonly INTEGER NOT NULL DEFAULT 0;
ALTER TABLE integration_links ADD COLUMN duplicate_of TEXT;
ALTER TABLE integration_connections ADD COLUMN sync_token TEXT;
ALTER TABLE integration_connections ADD COLUMN synced_at INTEGER;
ALTER TABLE integration_connections ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0;
