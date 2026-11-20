import { describe, it, expect, vi } from "vitest";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: "u5" }));

import { env, createExecutionContext } from "cloudflare:test";
import app from "../src/index";
import { getTask, insertTask } from "../src/db/tasks";
import type { Task } from "@dailify/shared";

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

    const before = await app.request("/tasks?month=2026-08", {}, env, createExecutionContext());
    const beforeBody = await before.json<{ tasks: Task[] }>();
    expect(beforeBody.tasks.some((t) => t.id === "del1")).toBe(true);

    const del = await app.request("/tasks/del1", { method: "DELETE" }, env);
    expect(del.status).toBe(204);

    const after = await app.request("/tasks?month=2026-08", {}, env, createExecutionContext());
    const afterBody = await after.json<{ tasks: Task[] }>();
    expect(afterBody.tasks.some((t) => t.id === "del1")).toBe(false);
  });
});

describe("DELETE /tasks/:id?updatedAt — LWW", () => {
  const edited = Date.UTC(2026, 7, 10, 12);
  const seed = (id: string) =>
    insertTask(env.DB, "u5", {
      id,
      title: "Edited elsewhere",
      date: edited,
      duration: "",
      priority: 0,
      repeat: "Off",
      completed: [],
      updatedAt: edited,
    });
  const remove = (id: string, at: number) =>
    app.request(`/tasks/${id}?updatedAt=${at}`, { method: "DELETE" }, env);

  it("a delete made before the stored edit loses, still answering 204", async () => {
    await seed("lww-stale");
    expect((await remove("lww-stale", edited - 1)).status).toBe(204);
    expect(await getTask(env.DB, "u5", "lww-stale")).toMatchObject({ title: "Edited elsewhere" });
  });

  it("a delete made at or after the stored edit wins", async () => {
    await seed("lww-fresh");
    expect((await remove("lww-fresh", edited)).status).toBe(204);
    expect(await getTask(env.DB, "u5", "lww-fresh")).toBeNull();
  });

  it("400 on a non-numeric updatedAt", async () => {
    expect((await remove("lww-fresh", NaN)).status).toBe(400);
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

    const month = await app.request("/tasks?month=2026-10", {}, env, createExecutionContext());
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
