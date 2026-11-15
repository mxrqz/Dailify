-- "A cada N" da recorrência (Task.repeatEvery). NULL = 1, então toda linha antiga segue igual.
ALTER TABLE tasks ADD COLUMN repeat_every INTEGER;
