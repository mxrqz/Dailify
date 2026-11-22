-- Google Tasks rides on the Calendar connection (bd Dailify-psjm). `tasks_synced_at` is the
-- `updatedMin` cursor of the next Tasks pull; NULL (every existing row) = pull every list in full.
ALTER TABLE integration_connections ADD COLUMN tasks_synced_at INTEGER;
