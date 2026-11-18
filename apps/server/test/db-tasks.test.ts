import { env } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import { applyD1Migrations } from "cloudflare:test";
import {
  appendCompletion,
  excludeOccurrence,
  getMonthTasks,
  getTask,
  insertTask,
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
    expect((await getTask(env.DB, "u2", "a2"))?.repeat).toEqual({ Weekly: ["Monday"] });
  });

  it("repeatUntil é gravado, atualizado e some quando a série acaba", async () => {
    const until = new Date(2026, 5, 1).getTime();
    const saved = await insertTask(
      env.DB,
      "u4",
      t({ id: "a4", repeat: "Daily", repeatUntil: until }),
    );
    expect(saved?.repeatUntil).toBe(until);
    expect((await updateTask(env.DB, "u4", "a4", { repeatUntil: until + 1 }))?.repeatUntil).toBe(
      until + 1,
    );
    await updateTask(env.DB, "u4", "a4", { repeat: "Off" });
    expect((await getTask(env.DB, "u4", "a4"))?.repeatUntil).toBeUndefined();
  });

  it("updateTask never touches completion history", async () => {
    const completedAt = new Date(2026, 0, 16, 9).getTime();
    await insertTask(env.DB, "u3", t({ id: "a3", completed: [completedAt] }));
    await updateTask(env.DB, "u3", "a3", { title: "renamed" });
    const saved = await getTask(env.DB, "u3", "a3");
    expect(saved).toMatchObject({ title: "renamed", completed: [completedAt] });
  });
});

describe("escritas concorrentes", () => {
  const T0 = Date.now() - 60_000;

  it("updateTask: a edição mais velha não pisa na nova quando as duas se cruzam", async () => {
    await insertTask(env.DB, "c1", t({ id: "c1", updatedAt: T0 }));
    await Promise.all([
      updateTask(env.DB, "c1", "c1", { title: "nova", updatedAt: T0 + 2000 }),
      updateTask(env.DB, "c1", "c1", { title: "velha", updatedAt: T0 + 1000 }),
    ]);
    expect((await getTask(env.DB, "c1", "c1"))?.title).toBe("nova");
  });

  it("appendCompletion de um instante passado não abaixa o updatedAt", async () => {
    await insertTask(env.DB, "c2", t({ id: "c2", updatedAt: T0 + 2000 }));
    const done = await appendCompletion(env.DB, "c2", "c2", T0 + 1000);
    expect(done?.updatedAt).toBe(T0 + 2000);
    expect((await getTask(env.DB, "c2", "c2"))?.updatedAt).toBe(T0 + 2000);
  });

  it("duas conclusões simultâneas ficam as duas", async () => {
    await insertTask(env.DB, "c3", t({ id: "c3", updatedAt: T0 }));
    await Promise.all([
      appendCompletion(env.DB, "c3", "c3", T0 + 1000),
      appendCompletion(env.DB, "c3", "c3", T0 + 2000),
    ]);
    expect((await getTask(env.DB, "c3", "c3"))?.completed.sort()).toEqual([T0 + 1000, T0 + 2000]);
  });

  it("duas exclusões de ocorrência simultâneas ficam as duas", async () => {
    await insertTask(env.DB, "c4", t({ id: "c4", repeat: "Daily" }));
    const [a, b] = [t().date + 86_400_000, t().date + 2 * 86_400_000];
    await Promise.all([
      excludeOccurrence(env.DB, "c4", "c4", a),
      excludeOccurrence(env.DB, "c4", "c4", b),
    ]);
    expect((await getTask(env.DB, "c4", "c4"))?.exdates?.sort()).toEqual([a, b]);
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
