import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u1" })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, getUserRole: vi.fn(async () => "pro+ai") };
});

import { env, applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { insertTask } from "../src/db/tasks";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const date = new Date(2026, 4, 15, 9).getTime();
const base: Task = {
  id: "x",
  title: "t",
  date,
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
};

const json = (method: string, body: unknown) => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const get = async (path: string) => (await app.request(path, {}, env)).json<{ tasks: Task[] }>();

describe("tarefas Sem data", () => {
  it("POST grava undated e GET /tasks/undated devolve", async () => {
    const res = await app.request("/tasks", json("POST", { title: "a", date, undated: true }), env);
    const { task } = await res.json<{ task: Task }>();
    expect(task.undated).toBe(true);
    const { tasks } = await get("/tasks/undated");
    expect(tasks.find((t) => t.id === task.id)?.undated).toBe(true);
  });

  it("com âncora no mês, avulsa e Daily ficam fora de GET /tasks?month=", async () => {
    await insertTask(env.DB, "u1", { ...base, id: "ud-one", undated: true });
    await insertTask(env.DB, "u1", {
      ...base,
      id: "ud-daily",
      repeat: "Daily",
      undated: true,
    });
    const { tasks } = await get("/tasks?month=2026-05");
    expect(tasks.filter((t) => t.id.startsWith("ud-"))).toEqual([]);
  });

  it("/undated não traz agenda nem outro usuário", async () => {
    await insertTask(env.DB, "u1", { ...base, id: "agenda1" });
    await insertTask(env.DB, "u2", { ...base, id: "other1", undated: true });
    const { tasks } = await get("/tasks/undated");
    const ids = tasks.map((t) => t.id);
    expect(ids).not.toContain("agenda1");
    expect(ids).not.toContain("other1");
  });

  it("PATCH só com title mantém undated; undated:false vira agenda", async () => {
    await insertTask(env.DB, "u1", { ...base, id: "ud-patch", undated: true });
    const r1 = await app.request("/tasks/ud-patch", json("PATCH", { title: "novo" }), env);
    expect((await r1.json<{ task: Task }>()).task.undated).toBe(true);

    const r2 = await app.request("/tasks/ud-patch", json("PATCH", { undated: false }), env);
    expect((await r2.json<{ task: Task }>()).task.undated).toBeUndefined();
    const { tasks } = await get("/tasks?month=2026-05");
    expect(tasks.some((t) => t.id === "ud-patch")).toBe(true);
  });
});
