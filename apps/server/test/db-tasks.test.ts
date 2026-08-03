import { env } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import { applyD1Migrations } from "cloudflare:test";
import {
  insertTask,
  getMonthTasks,
  countRecurringTasks,
  getTask,
  updateTask,
} from "../src/db/tasks";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const t = (over: Partial<Task> = {}): Task => ({
  id: "a1",
  title: "T",
  description: "d",
  date: new Date(2026, 0, 15, 9).getTime(),
  duration: "10m",
  priority: 0,
  repeat: "Off",
  completed: [],
  tags: ["x"],
  ...over,
});

describe("db/tasks", () => {
  it("round-trips a task", async () => {
    await insertTask(env.DB, "u1", t());
    const rows = await getMonthTasks(env.DB, "u1", new Date(2026, 0, 1));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "a1", tags: ["x"], repeat: "Off", completed: [] });
  });

  it("stores Weekly repeat as kind+days", async () => {
    await insertTask(env.DB, "u2", t({ id: "a2", repeat: { Weekly: ["Monday"] } }));
    expect(await countRecurringTasks(env.DB, "u2")).toBe(1);
  });

  it("updateTask never touches completion history", async () => {
    const completedAt = new Date(2026, 0, 16, 9).getTime();
    await insertTask(env.DB, "u3", t({ id: "a3", completed: [completedAt] }));
    await updateTask(env.DB, "u3", "a3", { title: "renamed" });
    const saved = await getTask(env.DB, "u3", "a3");
    expect(saved).toMatchObject({ title: "renamed", completed: [completedAt] });
  });
});
