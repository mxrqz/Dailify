import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u4" })) };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { insertTask } from "../src/db/tasks";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("POST /tasks/:id/complete", () => {
  it("appends one epoch-ms completion entry", async () => {
    await insertTask(env.DB, "u4", {
      id: "comp1",
      title: "Task",
      date: new Date(2026, 6, 1, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });
    const before = Date.now();
    const res = await app.request("/tasks/comp1/complete", { method: "POST" }, env);
    const after = Date.now();
    expect(res.status).toBe(200);
    const body = await res.json<{ task: Task }>();
    expect(body.task.completed).toHaveLength(1);
    expect(body.task.completed[0]).toBeGreaterThanOrEqual(before);
    expect(body.task.completed[0]).toBeLessThanOrEqual(after);
  });

  it("404s for a missing task", async () => {
    const res = await app.request("/tasks/nope/complete", { method: "POST" }, env);
    expect(res.status).toBe(404);
  });
});

describe("DELETE /tasks/:id/complete", () => {
  const from = new Date(2026, 6, 3, 0, 0, 0).getTime();
  const to = new Date(2026, 6, 3, 23, 59, 59, 999).getTime();

  it("removes only the completion inside the range", async () => {
    const other = new Date(2026, 6, 4, 10).getTime();
    await insertTask(env.DB, "u4", {
      id: "unc1",
      title: "Task",
      date: new Date(2026, 6, 3).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Daily",
      completed: [new Date(2026, 6, 3, 10).getTime(), other],
    });

    const res = await app.request(
      `/tasks/unc1/complete?from=${from}&to=${to}`,
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ task: Task }>();
    expect(body.task.completed).toEqual([other]);
  });

  it("400s on a range that isn't two numbers", async () => {
    const res = await app.request("/tasks/unc1/complete?from=abc&to=1", { method: "DELETE" }, env);
    expect(res.status).toBe(400);
  });

  it("404s for a missing task", async () => {
    const res = await app.request(
      `/tasks/nope/complete?from=${from}&to=${to}`,
      { method: "DELETE" },
      env,
    );
    expect(res.status).toBe(404);
  });
});
