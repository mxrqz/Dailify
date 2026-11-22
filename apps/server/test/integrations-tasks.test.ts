import { describe, it, expect, vi, beforeEach } from "vitest";

let userId = "eu1";
vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: userId }));

import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { zonedEpoch } from "@dailify/shared";
import app from "../src/index";
import { sealTokens } from "../src/integrations/connection";
import { syncCalendar } from "../src/integrations/google-calendar/sync";
import { readTask, taskFields } from "../src/integrations/google-calendar/tasks";
import { upsertConnection } from "../src/db/integrations";
import { saveSettings } from "../src/db/settings";
import { getTask } from "../src/db/tasks";
import * as google from "./fixtures/google-calendar";

const TZ = "America/Sao_Paulo";
const DAY = 86_400_000;
const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const LIST = google.tasklists.items[0].id;
const TASKS_URL = `${google.TASKS}/lists/${LIST}/tasks`;
const PATH = (id: string) => `lists/${LIST}/tasks/${id}`;
const PATCHED = "2030-01-01T00:00:00.000Z";

let items: unknown[];
let calls: { url: string; method: string; body: string }[];

beforeEach(async () => {
  userId = `eu-${crypto.randomUUID()}`;
  items = [];
  calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: String(init?.body ?? "") });
    if (url.startsWith(`${google.EVENTS}?`))
      return Response.json({ items: [], nextSyncToken: "t" });
    if (url.startsWith(`${google.TASKS}/users/@me/lists?`)) return Response.json(google.tasklists);
    if (url.startsWith(`${TASKS_URL}?`)) return Response.json({ kind: "tasks#tasks", items });
    if (url.startsWith(`${TASKS_URL}/`) && method === "PATCH")
      return Response.json({ ...google.gtask, updated: PATCHED });
    throw new Error(`fetch não mockado: ${url}`);
  });
  await connect(`${google.token.scope} ${google.TASKS_SCOPE}`);
  await saveSettings(env.DB, userId, { timeZone: TZ });
});

async function connect(scopes: string) {
  const tokens = await sealTokens(env, userId, "google-calendar", {
    accessToken: "ya29.ok",
    refreshToken: "1//refresh-1",
    scope: scopes,
    expiresAt: NOW + 3_600_000,
  });
  await upsertConnection(
    env.DB,
    userId,
    "google-calendar",
    { accountId: "1098765", email: "pessoa@gmail.com", scopes, tokens },
    NOW,
  );
}

const gtask = (id: string, over: object = {}) => ({
  ...google.gtask,
  id,
  updated: iso(NOW - DAY),
  ...over,
});

/** A fresh pass each call: clears the 60 s throttle. */
async function sync() {
  await env.DB.prepare(`UPDATE integration_connections SET synced_at=NULL WHERE user_id=?`)
    .bind(userId)
    .run();
  return syncCalendar(env, userId);
}

const taskOf = async (id: string) => {
  const row = await env.DB.prepare(
    `SELECT task_id FROM integration_links WHERE user_id=? AND external_id=?`,
  )
    .bind(userId, PATH(id))
    .first<{ task_id: string }>();
  return row ? getTask(env.DB, userId, row.task_id) : null;
};
const tasksQueries = () =>
  calls.filter((c) => c.url.startsWith(`${TASKS_URL}?`)).map((c) => new URL(c.url).searchParams);

describe("Google Tasks mapping", () => {
  it("reads the due day, the completion and the API path", () => {
    const t = readTask(
      gtask("a", { due: "2026-11-20T00:00:00.000Z", status: "completed", completed: iso(NOW) }),
      LIST,
    );
    expect(t).toMatchObject({ externalId: PATH("a"), due: "2026-11-20", done: NOW });
    expect(readTask({ title: "no id" }, LIST)).toBeNull();
  });

  it("puts a due day on its 09:00 anchor and leaves no due without a day", () => {
    const due = taskFields({ ...readTask(gtask("a"), LIST)!, due: "2026-11-20" }, TZ, 1);
    const nine = zonedEpoch({ year: 2026, month: 10, day: 20, hour: 9, minute: 0, second: 0 }, TZ);
    expect(due).toMatchObject({ undated: true, date: nine, alert: nine, repeat: "Off" });
    expect(taskFields(readTask(gtask("b"), LIST)!, TZ, 1)).toMatchObject({
      undated: true,
      date: 1,
      alert: undefined,
    });
  });
});

describe("syncCalendar — Google Tasks", () => {
  it("imports open and recently done tasks, skips old completions", async () => {
    items = [
      gtask("open"),
      gtask("due", { due: "2026-11-20T00:00:00.000Z" }),
      gtask("done", { status: "completed", completed: iso(NOW - DAY) }),
      gtask("old", { status: "completed", completed: iso(NOW - 60 * DAY) }),
    ];
    expect(await sync()).toEqual({ imported: 3 });

    const open = await taskOf("open");
    expect(open).toMatchObject({ title: "Comprar pão", undated: true, completed: [] });
    expect(open?.alert).toBeUndefined();
    expect(open?.links).toEqual([google.gtask.webViewLink]);
    expect((await taskOf("due"))?.alert).toBe(
      zonedEpoch({ year: 2026, month: 10, day: 20, hour: 9, minute: 0, second: 0 }, TZ),
    );
    expect((await taskOf("done"))?.completed).toEqual([NOW - DAY]);
    expect(await taskOf("old")).toBeNull();
    // The full pull asks for hidden and completed tasks, without a cursor.
    expect(tasksQueries()[0].get("showHidden")).toBe("true");
    expect(tasksQueries()[0].get("updatedMin")).toBeNull();
  });

  it("goes incremental, applies Google's title and completion, and deletes", async () => {
    items = [gtask("a"), gtask("b")];
    await sync();
    items = [
      gtask("a", {
        title: "Pão e leite",
        status: "completed",
        completed: iso(NOW),
        updated: iso(NOW),
      }),
      gtask("b", { deleted: true, updated: iso(NOW) }),
    ];
    await sync();

    const q = tasksQueries()[1];
    expect(Date.parse(q.get("updatedMin") ?? "")).toBeLessThanOrEqual(NOW);
    expect(q.get("showDeleted")).toBe("true");
    expect(await taskOf("a")).toMatchObject({ title: "Pão e leite", completed: [NOW] });
    expect(await taskOf("b")).toBeNull();
  });

  it("a connection without the Tasks scope never calls Google Tasks", async () => {
    await connect(google.token.scope);
    await sync();
    expect(calls.some((c) => c.url.startsWith(google.TASKS))).toBe(false);
  });
});

describe("POST|DELETE /tasks/:id/complete — Google Tasks", () => {
  async function send(path: string, init: RequestInit) {
    const ctx = createExecutionContext();
    const res = await app.request(path, init, env, ctx);
    await waitOnExecutionContext(ctx);
    return res;
  }
  const patches = () => calls.filter((c) => c.method === "PATCH");

  it("completing and reopening mark the Google task, and its echo is skipped", async () => {
    items = [gtask("a")];
    await sync();
    const id = (await taskOf("a"))!.id;

    expect((await send(`/tasks/${id}/complete`, { method: "POST" })).status).toBe(200);
    expect(patches()[0].url).toBe(`${google.TASKS}/${PATH("a")}`);
    expect(JSON.parse(patches()[0].body)).toEqual({ status: "completed" });

    expect(
      (await send(`/tasks/${id}/complete?from=0&to=${Date.now() + DAY}`, { method: "DELETE" }))
        .status,
    ).toBe(200);
    expect(JSON.parse(patches()[1].body)).toEqual({ status: "needsAction", completed: null });

    // Google echoing our own PATCH changes nothing.
    items = [gtask("a", { status: "completed", completed: PATCHED, updated: PATCHED })];
    await sync();
    expect((await taskOf("a"))?.completed).toEqual([]);
  });

  it("a title edit reaches Google too", async () => {
    items = [gtask("a")];
    await sync();
    const id = (await taskOf("a"))!.id;
    await send(`/tasks/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Pão francês" }),
    });
    expect(JSON.parse(patches()[0].body)).toEqual({ title: "Pão francês" });
  });
});
