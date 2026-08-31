import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u5" })) };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { insertTask } from "../src/db/tasks";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("DELETE /tasks/:id", () => {
  it("removes the task from a later month read", async () => {
    await insertTask(env.DB, "u5", {
      id: "del1",
      title: "Gone soon",
      date: new Date(2026, 7, 10, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });

    const before = await app.request("/tasks?month=2026-08", {}, env);
    const beforeBody = await before.json<{ tasks: Task[] }>();
    expect(beforeBody.tasks.some((t) => t.id === "del1")).toBe(true);

    const del = await app.request("/tasks/del1", { method: "DELETE" }, env);
    expect(del.status).toBe(204);

    const after = await app.request("/tasks?month=2026-08", {}, env);
    const afterBody = await after.json<{ tasks: Task[] }>();
    expect(afterBody.tasks.some((t) => t.id === "del1")).toBe(false);
  });
});

describe("DELETE /tasks/:id?occurrence — excluir só esta", () => {
  const master = {
    id: "serie-del",
    title: "Academia",
    date: new Date(2026, 9, 1, 7).getTime(),
    duration: "1h",
    priority: 0,
    repeat: "Daily" as const,
    completed: [],
  };
  const occurrence = new Date(2026, 9, 12, 7).getTime();

  const removeOccurrence = (id: string, at: number) =>
    app.request(`/tasks/${id}?occurrence=${at}`, { method: "DELETE" }, env);

  it("some só com aquele dia e mantém a série", async () => {
    await insertTask(env.DB, "u5", master);

    const res = await removeOccurrence("serie-del", occurrence);
    expect(res.status).toBe(200);
    const { series } = await res.json<{ series: Task }>();
    expect(series.exdates).toEqual([occurrence]);

    const month = await app.request("/tasks?month=2026-10", {}, env);
    const { tasks } = await month.json<{ tasks: Task[] }>();
    expect(tasks.some((t) => t.date === occurrence)).toBe(false);
    // a série continua lá, com os outros dias
    expect(tasks.filter((t) => t.id === "serie-del").length).toBeGreaterThan(1);
  });

  it("404 quando a tarefa não é recorrente", async () => {
    await insertTask(env.DB, "u5", { ...master, id: "solo-del", repeat: "Off" });
    expect((await removeOccurrence("solo-del", occurrence)).status).toBe(404);
  });

  it("400 em occurrence não numérico", async () => {
    expect((await removeOccurrence("serie-del", NaN)).status).toBe(400);
  });
});
