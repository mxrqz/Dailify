import { Hono } from "hono";
import { DateTime } from "luxon";
import {
  MEW_CONSENT_REQUIRED,
  MEW_HISTORY_MAX,
  MEW_IMAGE_MAX,
  MEW_TEXT_MAX,
  type MewActionStatus,
  type MewReply,
  type MewRequest,
  type Role,
} from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getSettings } from "../db/settings";
import { getUndatedTasks, readMonth } from "../db/tasks";
import { aiQuotaError, debitAi } from "../db/limits";
import { aiTargets } from "../db/integrations";
import { logProposals, setActionStatus } from "../db/mew";
import { WINDOW_DAYS, agendaOf, askMew } from "../lib/mew";
import { isRecord } from "../lib/openai";
import { validZone } from "../lib/task-input";
import { fail } from "../lib/errors";

const STATUSES: readonly MewActionStatus[] = ["proposed", "done", "cancelled", "undone"];

const mew = new Hono<{ Bindings: Env; Variables: { userId: string; plan: Role } }>();
mew.use("*", requireAuth);

const isTurn = (v: unknown): v is MewRequest["history"][number] =>
  isRecord(v) &&
  (v.from === "me" || v.from === "mew") &&
  typeof v.text === "string" &&
  v.text.length <= MEW_TEXT_MAX;

function parseRequest(body: unknown): MewRequest | { error: string; status: 400 | 413 } {
  if (!isRecord(body)) return { error: "invalid body", status: 400 };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const image = body.image;
  if (image !== undefined && (typeof image !== "string" || !image.startsWith("data:image/")))
    return { error: "invalid image", status: 400 };
  if (image !== undefined && image.length > MEW_IMAGE_MAX)
    return { error: "image too large", status: 413 };
  if ((!text && !image) || text.length > MEW_TEXT_MAX)
    return { error: "invalid text", status: 400 };
  const timezone = validZone(body.timezone);
  if (!timezone) return { error: "invalid timezone", status: 400 };
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > MEW_HISTORY_MAX || !history.every(isTurn))
    return { error: "invalid history", status: 400 };
  return { text, timezone, history, ...(image && { image }) };
}

/** Undated tasks plus the months the ±`WINDOW_DAYS` window touches. */
async function readAgenda(db: D1Database, userId: string, timezone: string, now: number) {
  const today = DateTime.fromMillis(now, { zone: timezone });
  const months = [today.minus({ days: WINDOW_DAYS }), today.plus({ days: WINDOW_DAYS })]
    .map((d) => d.toFormat("yyyy-MM"))
    .filter((m, i, all) => all.indexOf(m) === i)
    .map((m) => {
      const [y, mo] = m.split("-").map(Number);
      return new Date(y, mo - 1, 1);
    });
  const read = await Promise.all([
    getUndatedTasks(db, userId),
    ...months.map((m) => readMonth(db, userId, m, timezone)),
  ]);
  return agendaOf(read.flat(), timezone, now);
}

mew.post("/chat", rateLimit("VOICE_LIMITER"), async (c) => {
  const userId = c.get("userId");
  const req = parseRequest(await c.req.json().catch(() => null));
  if ("error" in req) return fail(c, req.status, req.error);
  if (!(await getSettings(c.env.DB, userId)).mewConsent) return fail(c, 403, MEW_CONSENT_REQUIRED);
  const quotaError = await aiQuotaError(c);
  if (quotaError) return quotaError;

  const now = Date.now();
  const [agenda, allowed] = await Promise.all([
    readAgenda(c.env.DB, userId, req.timezone, now),
    aiTargets(c.env.DB, userId, c.get("plan")),
  ]);
  let reply: MewReply;
  try {
    reply = await askMew(c.env, req, agenda, allowed);
  } catch (err) {
    console.error(err);
    return fail(c, 502, "AI request failed");
  }
  await debitAi(c);
  await logProposals(c.env.DB, userId, reply.blocks, now);
  return c.json(reply);
});

mew.patch("/actions/:id", rateLimit("API_LIMITER"), async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const status = isRecord(body) ? STATUSES.find((s) => s === body.status) : undefined;
  if (!status) return fail(c, 400, "invalid status");
  const found = await setActionStatus(c.env.DB, c.get("userId"), c.req.param("id"), status);
  return found ? c.body(null, 204) : fail(c, 404, "Action not found");
});

export default mew;
