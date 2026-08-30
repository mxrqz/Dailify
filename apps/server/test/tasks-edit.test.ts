import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u3" })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, getUserRole: vi.fn(async () => "free" as const) };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { insertTask, getTask } from "../src/db/tasks";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const patch = (id: string, body: Record<string, unknown>) =>
  app.request(
    `/tasks/${id}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );

describe("PATCH /tasks/:id", () => {
  it("updates an existing task's title", async () => {
    await insertTask(env.DB, "u3", {
      id: "edit1",
      title: "Old title",
      date: new Date(2026, 4, 5, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });
    const res = await patch("edit1", { title: "New title" });
    expect(res.status).toBe(200);
    const body = await res.json<{ task: Task }>();
    expect(body.task.title).toBe("New title");
  });

  it("404s for a missing task", async () => {
    const res = await patch("nope", { title: "x" });
    expect(res.status).toBe(404);
  });

  it("still succeeds when the user is at the free monthly cap (no creation-limit charge)", async () => {
    const month = new Date(2026, 5, 1, 9).getTime();
    for (let i = 0; i < 30; i++) {
      await insertTask(env.DB, "u3", {
        id: `edit-cap-${i}`,
        title: `T${i}`,
        date: month,
        duration: "10m",
        priority: 0,
        repeat: "Off",
        completed: [],
      });
    }
    const res = await patch("edit-cap-0", { title: "Renamed at cap" });
    expect(res.status).toBe(200);
    const body = await res.json<{ task: Task }>();
    expect(body.task.title).toBe("Renamed at cap");
  });

  it("ignores a client-supplied completed — response and DB both keep the persisted history", async () => {
    await insertTask(env.DB, "u3", {
      id: "edit-completed",
      title: "Has history",
      date: new Date(2026, 6, 5, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [111],
    });
    const res = await patch("edit-completed", { title: "x", completed: [999] });
    expect(res.status).toBe(200);
    const body = await res.json<{ task: Task }>();
    expect(body.task.title).toBe("x");
    expect(body.task.completed).toEqual([111]);

    const saved = await getTask(env.DB, "u3", "edit-completed");
    expect(saved?.completed).toEqual([111]);
  });
});

describe("PATCH /tasks/:id — links", () => {
  it("aceita links validos", async () => {
    await insertTask(env.DB, "u3", {
      id: "edit-links-set",
      title: "Set links",
      date: new Date(2026, 7, 5, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });
    const res = await patch("edit-links-set", { links: ["https://meet.google.com/a"] });
    expect(res.status).toBe(200);
    const body = await res.json<{ task: Task }>();
    expect(body.task.links).toEqual(["https://meet.google.com/a"]);
  });

  it("rejeita link invalido", async () => {
    await insertTask(env.DB, "u3", {
      id: "edit-links-invalid",
      title: "Bad link",
      date: new Date(2026, 7, 5, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });
    const res = await patch("edit-links-invalid", { links: ["javascript:alert(1)"] });
    expect(res.status).toBe(400);
  });

  it("campo ausente nao apaga links existentes", async () => {
    await insertTask(env.DB, "u3", {
      id: "edit-links-untouched",
      title: "Keeps links",
      date: new Date(2026, 7, 5, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
      links: ["https://x.com"],
    });
    const res = await patch("edit-links-untouched", { title: "Renamed" });
    expect(res.status).toBe(200);
    const body = await res.json<{ task: Task }>();
    expect(body.task.links).toEqual(["https://x.com"]);
  });

  it("array vazio explicito limpa os links", async () => {
    await insertTask(env.DB, "u3", {
      id: "edit-links-clear",
      title: "Clears links",
      date: new Date(2026, 7, 5, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
      links: ["https://x.com"],
    });
    const res = await patch("edit-links-clear", { links: [] });
    expect(res.status).toBe(200);
    const body = await res.json<{ task: Task }>();
    expect(body.task.links).toBeUndefined();
  });
});

describe("PATCH /tasks/:id?occurrence — editar só esta ocorrência", () => {
  const master = {
    id: "serie",
    title: "Reunião diária",
    date: new Date(2026, 8, 1, 9).getTime(),
    duration: "30m",
    priority: 0,
    repeat: "Daily" as const,
    completed: [],
  };
  const occurrence = new Date(2026, 8, 10, 9).getTime();

  const patchOccurrence = (id: string, at: number, body: Record<string, unknown>) =>
    app.request(
      `/tasks/${id}?occurrence=${at}`,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      env,
    );

  it("destaca a ocorrência sem mover a série", async () => {
    await insertTask(env.DB, "u3", master);
    const res = await patchOccurrence("serie", occurrence, {
      title: "Reunião adiada",
      date: occurrence + 60 * 60 * 1000,
    });

    expect(res.status).toBe(200);
    const { task } = await res.json<{ task: Task }>();
    expect(task.id).not.toBe("serie");
    expect(task.repeat).toBe("Off");
    expect(task.title).toBe("Reunião adiada");

    const series = await getTask(env.DB, "u3", "serie");
    expect(series?.date).toBe(master.date); // a série ficou onde estava
    expect(series?.exdates).toEqual([occurrence]);
  });

  it("o mês não devolve a ocorrência destacada duas vezes", async () => {
    const res = await app.request("/tasks?month=2026-09", {}, env);
    const { tasks } = await res.json<{ tasks: Task[] }>();
    const atThatDay = tasks.filter((t) => t.date === occurrence);
    expect(atThatDay).toHaveLength(0); // a antiga sumiu; a nova está uma hora depois
    expect(tasks.some((t) => t.title === "Reunião adiada")).toBe(true);
  });

  it("404 quando a tarefa não é recorrente", async () => {
    await insertTask(env.DB, "u3", { ...master, id: "solo", repeat: "Off" });
    const res = await patchOccurrence("solo", occurrence, { title: "x" });
    expect(res.status).toBe(404);
  });

  it("400 em occurrence não numérico", async () => {
    const res = await patchOccurrence("serie", NaN, { title: "x" });
    expect(res.status).toBe(400);
  });
});
