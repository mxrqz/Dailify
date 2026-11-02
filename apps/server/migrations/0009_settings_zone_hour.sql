-- time_zone NULL = automático (o fuso do aparelho). hour12 0 = 24h.
ALTER TABLE user_settings ADD COLUMN time_zone TEXT;
ALTER TABLE user_settings ADD COLUMN hour12 INTEGER NOT NULL DEFAULT 0;
