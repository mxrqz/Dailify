import { describe, it, expect, vi } from "vitest";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: "u1" }));

import { env, createExecutionContext } from "cloudflare:test";
import app from "../src/index";
import { insertTask } from "../src/db/tasks";
import type { Task } from "@dailify/shared";

describe("GET /tasks", () => {
  it("400s on missing month", async () => {
    const res = await app.request("/tasks", {}, env);
    expect(res.status).toBe(400);
  });

  it("400s on invalid month", async () => {
    const res = await app.request("/tasks?month=nope", {}, env, createExecutionContext());
    expect(res.status).toBe(400);
  });

  it("400s on month 13 instead of reading January of the next year", async () => {
    const res = await app.request("/tasks?month=2026-13", {}, env, createExecutionContext());
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

    const res = await app.request("/tasks?month=2026-01", {}, env, createExecutionContext());
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

    const res = await app.request(
      "/tasks?month=2026-12&tz=America%2FSao_Paulo",
      {},
      env,
      createExecutionContext(),
    );
    const { tasks } = await res.json<{ tasks: Task[] }>();
    const instances = tasks.filter((t) => t.id === "tz-daily");

    expect(instances.length).toBeGreaterThan(1);
    // toda instância continua às 12:00Z = 09:00 local
    for (const t of instances) expect(new Date(t.date).getUTCHours()).toBe(12);
  });

  it("tz inválido é ignorado em vez de derrubar a leitura", async () => {
    const res = await app.request(
      "/tasks?month=2026-12&tz=Marte%2FOlympus",
      {},
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
  });
});

describe("GET /tasks — repeatEvery", () => {
  it("expande a cada 2 semanas e devolve o campo", async () => {
    await insertTask(env.DB, "u1", {
      id: "biweekly",
      title: "Faxina",
      date: Date.UTC(2026, 1, 2, 12), // seg 02/02 09:00 em São Paulo
      duration: "1h",
      priority: 0,
      repeat: { Weekly: ["Monday"] },
      repeatEvery: 2,
      completed: [],
    });

    const res = await app.request(
      "/tasks?month=2026-02&tz=America%2FSao_Paulo",
      {},
      env,
      createExecutionContext(),
    );
    const { tasks } = await res.json<{ tasks: Task[] }>();
    const days = tasks
      .filter((t) => t.id === "biweekly")
      .map((t) => new Date(t.date).getUTCDate())
      .sort((a, b) => a - b);
    expect(days).toEqual([2, 16]);
    expect(tasks.find((t) => t.id === "biweekly")?.repeatEvery).toBe(2);
  });
});
