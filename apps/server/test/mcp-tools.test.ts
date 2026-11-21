import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/auth", () => import("./session"));

import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { isRecord, zonedEpoch } from "@dailify/shared";
import app from "../src/index";
import { getTask, insertTask } from "../src/db/tasks";
import { saveSettings } from "../src/db/settings";

const ZONE = "America/Sao_Paulo";
let userId = "";

beforeEach(async () => {
  userId = `eu-${crypto.randomUUID()}`;
  await saveSettings(env.DB, userId, { timeZone: ZONE });
});

const rpc = (body: unknown, token = `mcp:${userId}`) =>
  app.request(
    "/mcp",
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
    createExecutionContext(),
  );

/** Calls a tool and returns its parsed text plus the error flag. */
async function tool(name: string, args: Record<string, unknown>) {
  const res = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  });
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  const result = isRecord(body) && isRecord(body.result) ? body.result : {};
  const content = Array.isArray(result.content) ? result.content[0] : undefined;
  const text = isRecord(content) && typeof content.text === "string" ? content.text : "";
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // plain text reply
  }
  return { data, isError: result.isError === true };
}

const local = (year: number, month: number, day: number, hour: number, minute = 0) =>
  zonedEpoch({ year, month: month - 1, day, hour, minute, second: 0 }, ZONE);

describe("POST /mcp — auth", () => {
  it("answers 401 with the resource metadata challenge without a token", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, "not-a-token");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${env.BETTER_AUTH_URL}/.well-known/oauth-protected-resource/mcp"`,
    );
  });

  it("rejects a foreign Origin and an unsupported protocol version", async () => {
    const init = (headers: Record<string, string>) => ({
      method: "POST",
      headers: { authorization: `Bearer mcp:${userId}`, ...headers },
      body: "{}",
    });
    expect((await app.request("/mcp", init({ origin: "https://evil.example" }), env)).status).toBe(
      403,
    );
    expect(
      (await app.request("/mcp", init({ "mcp-protocol-version": "1999-01-01" }), env)).status,
    ).toBe(400);
    expect((await app.request("/mcp", { method: "GET" }, env)).status).toBe(405);
  });
});

describe("POST /mcp — protocol", () => {
  it("initializes and lists the five tools", async () => {
    const init = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "t", version: "1" },
      },
    });
    expect(await init.json()).toMatchObject({
      result: { protocolVersion: "2025-06-18", serverInfo: { name: "mewki" } },
    });
    const list = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const body: unknown = await list.json();
    const tools =
      isRecord(body) && isRecord(body.result) && Array.isArray(body.result.tools)
        ? body.result.tools
        : [];
    expect(tools.map((t: unknown) => (isRecord(t) ? t.name : null))).toEqual([
      "list_tasks",
      "create_task",
      "update_task",
      "complete_task",
      "delete_task",
    ]);
  });
});

describe("POST /mcp — tools", () => {
  it("creates a task at local time and lists it back in the user's zone", async () => {
    const created = await tool("create_task", {
      title: "Dentist",
      date: "2026-12-03T14:30",
      duration: "45m",
    });
    expect(created.isError).toBe(false);
    expect(created.data).toMatchObject({
      task: { title: "Dentist", start: "2026-12-03T14:30", duration: "45m" },
    });

    const listed = await tool("list_tasks", { from: "2026-12-01", to: "2026-12-07" });
    expect(listed.data).toMatchObject({
      timeZone: ZONE,
      tasks: [{ title: "Dentist", start: "2026-12-03T14:30", done: false }],
    });
    // Stored as the São Paulo instant, not UTC.
    const [row] = await env.DB.prepare(`SELECT date FROM tasks WHERE user_id=?`).bind(userId).raw();
    expect(row[0]).toBe(local(2026, 12, 3, 14, 30));
  });

  it("completes and moves one occurrence of a series, and shifts the whole series", async () => {
    const id = `s${crypto.randomUUID().slice(0, 8)}`;
    await insertTask(env.DB, userId, {
      id,
      title: "Standup",
      date: local(2026, 12, 1, 9),
      duration: "15m",
      priority: 0,
      repeat: "Daily",
      completed: [],
    });

    const done = await tool("complete_task", { id, occurrence: "2026-12-02" });
    expect(done.isError).toBe(false);
    expect((await getTask(env.DB, userId, id))?.completed).toEqual([local(2026, 12, 2, 9)]);

    const needsDay = await tool("complete_task", { id });
    expect(needsDay.isError).toBe(true);

    const moved = await tool("update_task", {
      id,
      occurrence: "2026-12-04",
      date: "2026-12-04T11:00",
    });
    expect(moved.data).toMatchObject({ task: { start: "2026-12-04T11:00" } });

    // From the Dec 3 instance, one hour later for every day: the anchor moves by the same hour.
    await tool("update_task", {
      id,
      occurrence: "2026-12-03",
      series: true,
      date: "2026-12-03T10:00",
    });
    expect((await getTask(env.DB, userId, id))?.date).toBe(local(2026, 12, 1, 10));

    const listed = await tool("list_tasks", { from: "2026-12-02", to: "2026-12-03" });
    expect(listed.data).toMatchObject({
      tasks: [
        { id, start: "2026-12-02T10:00", done: true },
        { id, start: "2026-12-03T10:00", done: false },
      ],
    });
  });

  it("reports a bad argument and a missing task as tool errors", async () => {
    expect((await tool("create_task", { title: "x", date: "tomorrow" })).isError).toBe(true);
    expect((await tool("list_tasks", { from: "2026-01-01", to: "2026-12-31" })).isError).toBe(true);
    expect((await tool("delete_task", { id: "nope123" })).isError).toBe(true);
  });

  it("deletes a task", async () => {
    const created = await tool("create_task", { title: "Gone", date: "2026-12-05T08:00" });
    const task = isRecord(created.data) && isRecord(created.data.task) ? created.data.task : {};
    expect((await tool("delete_task", { id: task.id })).isError).toBe(false);
    expect(await getTask(env.DB, userId, String(task.id))).toBeNull();
  });
});
