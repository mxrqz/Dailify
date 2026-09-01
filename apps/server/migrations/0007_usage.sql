-- Uso consumido por quota. Só entra aqui o que não dá pra contar da tabela `tasks`: hoje só a voz,
-- que não deixa rastro nenhum depois que a transcrição foi paga.
-- `period` é 'YYYY-MM' para quota de escopo mensal e 'all' para vitalícia — assim a PK serve aos
-- dois escopos sem coluna nula.
CREATE TABLE usage (
  user_id TEXT NOT NULL,
  quota   TEXT NOT NULL,
  period  TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, quota, period)
);
