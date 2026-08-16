import { describe, it, expect, vi, beforeAll } from "vitest";

let role: "free" | "pro" | "pro+ai" = "free";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
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

describe("POST /tasks — links", () => {
  // Record<string, unknown> em vez de TaskInput: os casos de payload invalido (links: 42,
  // links: "string") nao tipam contra TaskInput de proposito — o ponto do teste e mandar lixo.
  const post = (body: Record<string, unknown>) =>
    app.request(
      "/tasks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
      env,
    );

  it("aceita http e https", async () => {
    role = "pro";
    const res = await post({
      ...taskInput(),
      links: ["https://meet.google.com/a", "http://x.com"],
    });
    expect(res.status).toBe(200);
    const { task } = await res.json<{ task: Task }>();
    expect(task.links).toEqual(["https://meet.google.com/a", "http://x.com"]);
  });

  it.each([
    ["javascript:", ["javascript:alert(1)"]],
    ["data:", ["data:text/html,<script>alert(1)</script>"]],
    ["string solta", ["nao e url"]],
    ["nao-array", "https://x.com"],
    ["item nao-string", [42]],
    ["credencial embutida", ["https://user:pass@evil.com"]],
    ["spoof tipo paypal.com@evil.com", ["https://paypal.com@evil.com"]],
  ])("rejeita %s", async (_label, links) => {
    role = "pro";
    const res = await post({ ...taskInput(), links });
    expect(res.status).toBe(400);
  });

  it("rejeita mais de 10 links", async () => {
    role = "pro";
    const links = Array.from({ length: 11 }, (_, i) => `https://x.com/${i}`);
    expect((await post({ ...taskInput(), links })).status).toBe(400);
  });

  const urlOfLength = (len: number) => "https://x.com/" + "a".repeat(len - "https://x.com/".length);

  it("aceita URL com exatamente 2048 caracteres", async () => {
    role = "pro";
    const url = urlOfLength(2048);
    const res = await post({ ...taskInput(), links: [url] });
    expect(res.status).toBe(200);
  });

  it.each([
    ["2049 caracteres", 2049],
    ["100KB", 100_000],
  ])("rejeita URL com %s", async (_label, len) => {
    role = "pro";
    const res = await post({ ...taskInput(), links: [urlOfLength(len)] });
    expect(res.status).toBe(400);
  });

  it("sem links continua criando", async () => {
    role = "pro";
    expect((await post(taskInput())).status).toBe(200);
  });
});
