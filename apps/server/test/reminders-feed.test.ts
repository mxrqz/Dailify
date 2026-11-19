import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/auth", () => import("./session"));
import { mockSession, seedUser } from "./session";

import { env } from "cloudflare:workers";
import { makeTask } from "@dailify/shared/testing";
import type { ReminderFeed, ReminderToken } from "@dailify/shared";
import app from "../src/index";
import { insertTask } from "../src/db/tasks";
import { FEED_HORIZON_MS, reminderFeed } from "../src/lib/reminder-feed";

const SP = "America/Sao_Paulo";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("reminderFeed", () => {
  const now = Date.UTC(2026, 4, 20, 12);

  it("lists a one-off alert inside the window with the task's own time", () => {
    const task = makeTask({ date: now + 2 * HOUR, alert: now + HOUR });
    expect(reminderFeed([task], now, SP, 1)).toEqual([
      { id: `t1:${now + HOUR}`, title: "task", at: now + 2 * HOUR, fireAt: now + HOUR },
    ]);
  });

  it("skips past, out-of-window and completed one-offs", () => {
    const tasks = [
      makeTask({ id: "past", date: now, alert: now - HOUR }),
      makeTask({ id: "far", date: now + FEED_HORIZON_MS + HOUR, alert: now + FEED_HORIZON_MS + 1 }),
      makeTask({ id: "done", date: now + HOUR, alert: now + HOUR, completed: [now] }),
    ];
    expect(reminderFeed(tasks, now, SP, 1)).toEqual([]);
  });

  it("expands a daily series keeping the offset, one per day, across a month end", () => {
    // 09:00 in São Paulo (12:00Z), alert 10 min before, starting May 1.
    const daily = makeTask({
      date: Date.UTC(2026, 4, 1, 12),
      alert: Date.UTC(2026, 4, 1, 11, 50),
      repeat: "Daily",
    });
    const feed = reminderFeed([daily], now, SP, 1);
    expect(feed).toHaveLength(14);
    expect(feed[0]).toMatchObject({
      fireAt: Date.UTC(2026, 4, 21, 11, 50),
      at: Date.UTC(2026, 4, 21, 12),
    });
    expect(feed.at(-1)?.fireAt).toBe(Date.UTC(2026, 5, 3, 11, 50));
  });

  it("skips the occurrence already completed on its day", () => {
    const daily = makeTask({
      date: Date.UTC(2026, 4, 1, 12),
      alert: Date.UTC(2026, 4, 1, 11, 50),
      repeat: "Daily",
      completed: [Date.UTC(2026, 4, 21, 10)],
    });
    const feed = reminderFeed([daily], now, SP, 1);
    expect(feed[0].fireAt).toBe(Date.UTC(2026, 4, 22, 11, 50));
  });

  it("caps the list at 100, soonest first", () => {
    const tasks = Array.from({ length: 120 }, (_, i) =>
      makeTask({ id: `t${i}`, date: now + (120 - i) * HOUR, alert: now + (120 - i) * HOUR }),
    );
    const feed = reminderFeed(tasks, now, SP, 1);
    expect(feed).toHaveLength(100);
    expect(feed[0].fireAt).toBe(now + HOUR);
  });
});

describe("POST /reminders/token + GET /reminders/feed", () => {
  let userId = "";
  beforeEach(async () => {
    userId = `rf-${crypto.randomUUID()}`;
    mockSession(() => ({ id: userId }));
    await seedUser(env.DB, userId);
    const at = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO "session" (id, expiresAt, token, createdAt, updatedAt, userId)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(`session-${userId}`, at, `tok-${userId}`, at, at, userId)
      .run();
  });

  const mint = async () => {
    const res = await app.request("/reminders/token", { method: "POST" }, env);
    expect(res.status).toBe(200);
    const body: ReminderToken = await res.json();
    return body.token;
  };
  const feed = (token: string) =>
    app.request(`/reminders/feed?tz=${SP}`, { headers: { authorization: `Bearer ${token}` } }, env);

  it("serves the owner's upcoming alerts to the feed token, not other users'", async () => {
    const soon = Date.now() + DAY;
    await insertTask(env.DB, userId, makeTask({ id: `${userId}-a`, date: soon, alert: soon }));
    await insertTask(env.DB, `other-${userId}`, makeTask({ id: `${userId}-b`, alert: soon }));

    const res = await feed(await mint());
    expect(res.status).toBe(200);
    const body: ReminderFeed = await res.json();
    expect(body.reminders).toEqual([
      { id: `${userId}-a:${soon}`, title: "task", at: soon, fireAt: soon },
    ]);
  });

  it("answers 401 to a missing or unknown token", async () => {
    expect((await app.request("/reminders/feed", {}, env)).status).toBe(401);
    expect((await feed("nope")).status).toBe(401);
  });

  it("a new token replaces the session's old one", async () => {
    const first = await mint();
    await mint();
    expect((await feed(first)).status).toBe(401);
  });

  it("signing out (the session row going away) revokes the token", async () => {
    const token = await mint();
    await env.DB.prepare(`DELETE FROM "session" WHERE id=?`).bind(`session-${userId}`).run();
    expect((await feed(token)).status).toBe(401);
  });
});
