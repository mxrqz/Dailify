-- Integrações (epic zpq). `tokens` é JSON cifrado (src/integrations/crypto.ts, v1.<iv>.<ct>, AAD
-- user:provider): um dump do D1 sozinho não entrega acesso às contas de ninguém.
CREATE TABLE integration_connections (
  user_id       TEXT NOT NULL,
  provider      TEXT NOT NULL,
  account_id    TEXT NOT NULL,
  account_email TEXT,
  scopes        TEXT NOT NULL,
  tokens        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (user_id, provider)
);

-- Tarefa <-> objeto externo; o UNIQUE impede dois vínculos pro mesmo evento.
CREATE TABLE integration_links (
  user_id     TEXT NOT NULL,
  provider    TEXT NOT NULL,
  task_id     TEXT NOT NULL,
  external_id TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, provider, task_id),
  UNIQUE (user_id, provider, external_id)
);

-- `state` do OAuth, uso único: consumido com DELETE ... RETURNING.
CREATE TABLE oauth_states (
  state         TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  provider      TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  expires_at    INTEGER NOT NULL
);
