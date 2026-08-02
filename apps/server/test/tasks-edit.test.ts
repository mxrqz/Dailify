import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@hono/clerk-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hono/clerk-auth")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u3" })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, getUserRole: vi.fn(async () => "free" as const) };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { insertTask } from "../src/db/tasks";
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
      description: "",
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
        description: "",
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
});
