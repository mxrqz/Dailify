import { Hono } from "hono";
import { isWeekStart } from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getWeekStart, setWeekStart } from "../db/settings";
import { fail } from "../lib/errors";

const settings = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
settings.use("/settings", requireAuth, rateLimit("API_LIMITER"));

settings.get("/settings", async (c) =>
  c.json({ weekStart: await getWeekStart(c.env.DB, c.get("userId")) }),
);

settings.put("/settings", async (c) => {
  const body = await c.req.json().catch(() => null);
  const weekStart =
    typeof body === "object" && body !== null ? Reflect.get(body, "weekStart") : null;
  if (!isWeekStart(weekStart)) return fail(c, 400, "invalid weekStart");
  await setWeekStart(c.env.DB, c.get("userId"), weekStart);
  return c.json({ weekStart });
});

export default settings;
