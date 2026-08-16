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

describe("links", () => {
  it("sobrevive a insert → read", async () => {
    const task: Task = {
      id: "lk1",
      title: "Reunião",
      date: new Date(2026, 7, 14, 15).getTime(),
      duration: "1h",
      priority: 0,
      repeat: "Off",
      links: ["https://meet.google.com/abc"],
      completed: [],
    };
    await insertTask(env.DB, "u1", task);
    expect((await getTask(env.DB, "u1", "lk1"))?.links).toEqual(["https://meet.google.com/abc"]);
  });

  it("sem links volta undefined, não array vazio", async () => {
    await insertTask(env.DB, "u1", {
      id: "lk2",
      title: "Sem link",
      date: Date.now(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });
    expect((await getTask(env.DB, "u1", "lk2"))?.links).toBeUndefined();
  });

  it("update troca a lista", async () => {
    await updateTask(env.DB, "u1", "lk1", { links: ["https://youtu.be/xyz"] });
    expect((await getTask(env.DB, "u1", "lk1"))?.links).toEqual(["https://youtu.be/xyz"]);
  });
});
