import { Hono } from "hono";
import { isRecord, isWeekStart, type UserSettings } from "@dailify/shared";
import type { AppEnv } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getSettings, saveSettings } from "../db/settings";
import { fail } from "../lib/errors";
import { readJson, validZone } from "../lib/task-input";

const settings = new Hono<AppEnv>();
settings.use("/settings", requireAuth, rateLimit("API_LIMITER"));

settings.get("/settings", async (c) => c.json(await getSettings(c.env.DB, c.get("userId"))));

/** Corpo parcial: cada chave que veio precisa ser válida, e pelo menos uma tem que vir. */
function parsePatch(body: unknown): Partial<UserSettings> | null {
  if (!isRecord(body)) return null;
  const patch: Partial<UserSettings> = {};
  if ("weekStart" in body) {
    const weekStart = body.weekStart;
    if (!isWeekStart(weekStart)) return null;
    patch.weekStart = weekStart;
  }
  if ("timeZone" in body) {
    const timeZone = body.timeZone === null ? null : validZone(body.timeZone);
    if (timeZone === undefined) return null;
    patch.timeZone = timeZone;
  }
  if ("hour12" in body) {
    const hour12 = body.hour12;
    if (typeof hour12 !== "boolean") return null;
    patch.hour12 = hour12;
  }
  if ("mewConsent" in body) {
    const mewConsent = body.mewConsent;
    if (typeof mewConsent !== "boolean") return null;
    patch.mewConsent = mewConsent;
  }
  return Object.keys(patch).length ? patch : null;
}

settings.put("/settings", async (c) => {
  const patch = parsePatch(await readJson(c));
  if (!patch) return fail(c, 400, "invalid settings");
  return c.json(await saveSettings(c.env.DB, c.get("userId"), patch));
});

export default settings;
