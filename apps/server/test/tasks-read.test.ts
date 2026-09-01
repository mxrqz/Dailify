import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u1" })) };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { insertTask } from "../src/db/tasks";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("GET /tasks", () => {
  it("400s on missing month", async () => {
    const res = await app.request("/tasks", {}, env);
    expect(res.status).toBe(400);
  });

  it("400s on invalid month", async () => {
    const res = await app.request("/tasks?month=nope", {}, env);
    expect(res.status).toBe(400);
  });

  it("expands a Daily recurring task across the month, deduped", async () => {
    const task: Task = {
      id: "daily1",
      title: "Standup",
      date: new Date(2026, 0, 15, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Daily",
      completed: [],
    };
    await insertTask(env.DB, "u1", task);

    const res = await app.request("/tasks?month=2026-01", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ tasks: Task[] }>();
    const mine = body.tasks.filter((t) => t.id === "daily1");
    // The stored Jan-15 row plus expanded instances for Jan 16-31.
    expect(mine.length).toBeGreaterThan(1);
    const keys = new Set(mine.map((t) => `${t.id}-${t.date}`));
    expect(keys.size).toBe(mine.length); // deduped
  });
});

describe("GET /tasks?tz — fuso do cliente", () => {
  it("expande a recorrente na hora local do usuário, não em UTC", async () => {
    await insertTask(env.DB, "u1", {
      id: "tz-daily",
      title: "Diária 09:00 SP",
      date: Date.UTC(2026, 11, 1, 12, 0), // 09:00 em São Paulo
      duration: "10m",
      priority: 0,
      repeat: "Daily",
      completed: [],
    });

    const res = await app.request("/tasks?month=2026-12&tz=America%2FSao_Paulo", {}, env);
    const { tasks } = await res.json<{ tasks: Task[] }>();
    const instances = tasks.filter((t) => t.id === "tz-daily");

    expect(instances.length).toBeGreaterThan(1);
    // toda instância continua às 12:00Z = 09:00 local
    for (const t of instances) expect(new Date(t.date).getUTCHours()).toBe(12);
  });

  it("tz inválido é ignorado em vez de derrubar a leitura", async () => {
    const res = await app.request("/tasks?month=2026-12&tz=Marte%2FOlympus", {}, env);
    expect(res.status).toBe(200);
  });
});
