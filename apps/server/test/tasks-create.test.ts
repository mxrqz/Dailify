import { describe, it, expect, vi, beforeAll } from "vitest";

let role: "free" | "pro" | "pro+ai" = "free";

vi.mock("@hono/clerk-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hono/clerk-auth")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u2" })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, getUserRole: vi.fn(async () => role) };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { insertTask, getTask } from "../src/db/tasks";
import type { Task, TaskInput } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const taskInput = (over: Partial<TaskInput> = {}): TaskInput => ({
  title: "New task",
  description: "",
  date: new Date(2026, 2, 10, 9).getTime(),
  duration: "10m",
  priority: 0,
  repeat: "Off",
  ...over,
});

describe("POST /tasks", () => {
  it("creates under the limit and the row is queryable", async () => {
    role = "free";
    const res = await app.request(
      "/tasks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(taskInput({ title: "Under limit" })),
      },
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json<{ task: Task }>();
    expect(body.task.id).toBeTruthy();
    const saved = await getTask(env.DB, "u2", body.task.id);
    expect(saved).toMatchObject({ title: "Under limit" });
  });

  it("429s a free user creating a recurring task", async () => {
    role = "free";
    const res = await app.request(
      "/tasks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(taskInput({ repeat: "Daily" })),
      },
      env,
    );
    expect(res.status).toBe(429);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Recurring Tasks Limit Reached");
  });

  it("429s a free user at the 30-task monthly cap", async () => {
    role = "free";
    const month = new Date(2026, 3, 1, 9).getTime();
    for (let i = 0; i < 30; i++) {
      await insertTask(env.DB, "u2", {
        id: `cap-${i}`,
        title: `T${i}`,
        description: "",
        date: month,
        duration: "10m",
        priority: 0,
        repeat: "Off",
        completed: [],
      });
    }
    const res = await app.request(
      "/tasks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(taskInput({ date: month, title: "31st" })),
      },
      env,
    );
    expect(res.status).toBe(429);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Monthly Tasks Limit Reached");
  });
});
