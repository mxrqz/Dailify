-- Web Push: uma linha por browser/device inscrito. `endpoint` é a chave natural (o próprio push
-- service já garante unicidade dela), então re-inscrever o mesmo device faz UPSERT, não duplica.
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Marca de "alerta já disparado": sem ela, cada passada do cron reenviaria o mesmo lembrete.
ALTER TABLE tasks ADD COLUMN alert_sent INTEGER;
CREATE INDEX idx_tasks_alert ON tasks(alert) WHERE alert IS NOT NULL;
