import { Hono, type MiddlewareHandler } from "hono";
import type { ReminderFeed, ReminderToken } from "@dailify/shared";
import type { AppEnv } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getReminderTokenUser, listAlertTasks, saveReminderToken } from "../db/reminders";
import { getSettings } from "../db/settings";
import { bytesToBase64url, sha256b64url } from "../lib/encoding";
import { fail } from "../lib/errors";
import { FEED_HORIZON_MS, reminderFeed } from "../lib/reminder-feed";
import { validZone } from "../lib/task-input";

/** The Android background sync: no WebView, so it holds a read-only feed token, not the session. */
const reminders = new Hono<AppEnv>();

const feedAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = c.req.header("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  const userId = token && (await getReminderTokenUser(c.env.DB, await sha256b64url(token)));
  if (!userId) return fail(c, 401, "Unauthorized");
  c.set("userId", userId);
  await next();
};

reminders.post("/token", requireAuth, rateLimit("API_LIMITER"), async (c) => {
  const token = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
  await saveReminderToken(c.env.DB, c.get("userId"), c.get("sessionId"), await sha256b64url(token));
  return c.json({ token } satisfies ReminderToken);
});

reminders.get("/feed", feedAuth, rateLimit("API_LIMITER"), async (c) => {
  const userId = c.get("userId");
  const now = Date.now();
  const settings = await getSettings(c.env.DB, userId);
  const timeZone = settings.timeZone ?? validZone(c.req.query("tz")) ?? "UTC";
  const tasks = await listAlertTasks(c.env.DB, userId, now, now + FEED_HORIZON_MS);
  return c.json({
    reminders: reminderFeed(tasks, now, timeZone, settings.weekStart),
  } satisfies ReminderFeed);
});

export default reminders;
