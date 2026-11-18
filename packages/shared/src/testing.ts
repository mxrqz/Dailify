import type { Task } from "./types";

/** A valid Task for tests; a new required field gets its default here, not in every test file. */
export const makeTask = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "task",
  date: Date.UTC(2026, 0, 1, 12),
  duration: "10m",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...over,
});
