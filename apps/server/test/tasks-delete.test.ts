import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@hono/clerk-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hono/clerk-auth")>();
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
      description: "",
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
