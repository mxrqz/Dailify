import { Hono } from "hono";
import { IANAZone } from "luxon";
import { isWeekStart } from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getSettings, saveSettings, type UserSettings } from "../db/settings";
import { fail } from "../lib/errors";

const settings = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
settings.use("/settings", requireAuth, rateLimit("API_LIMITER"));

settings.get("/settings", async (c) => c.json(await getSettings(c.env.DB, c.get("userId"))));

/** Corpo parcial: cada chave que veio precisa ser válida, e pelo menos uma tem que vir. */
function parsePatch(body: unknown): Partial<UserSettings> | null {
  if (typeof body !== "object" || body === null) return null;
  const patch: Partial<UserSettings> = {};
  if ("weekStart" in body) {
    const weekStart = Reflect.get(body, "weekStart");
    if (!isWeekStart(weekStart)) return null;
    patch.weekStart = weekStart;
  }
  if ("timeZone" in body) {
    const timeZone = Reflect.get(body, "timeZone");
    if (timeZone !== null && !(typeof timeZone === "string" && IANAZone.isValidZone(timeZone)))
      return null;
    patch.timeZone = timeZone;
  }
  if ("hour12" in body) {
    const hour12 = Reflect.get(body, "hour12");
    if (typeof hour12 !== "boolean") return null;
    patch.hour12 = hour12;
  }
  return Object.keys(patch).length ? patch : null;
}

settings.put("/settings", async (c) => {
  const patch = parsePatch(await c.req.json().catch(() => null));
  if (!patch) return fail(c, 400, "invalid settings");
  return c.json(await saveSettings(c.env.DB, c.get("userId"), patch));
});

export default settings;
