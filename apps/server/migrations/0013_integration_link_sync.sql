-- F4: a edição da tarefa remonta o evento no fuso em que ele foi criado (o Worker roda em UTC), e
-- `stale` = a última propagação falhou: o web mostra "não sincronizado" e oferece reenviar.
ALTER TABLE integration_links ADD COLUMN time_zone TEXT;
ALTER TABLE integration_links ADD COLUMN stale INTEGER NOT NULL DEFAULT 0;
