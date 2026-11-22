import { Hono } from "hono";
import {
  API_ERROR,
  INTEGRATIONS,
  isRecord,
  MEW_CONSENT_REQUIRED,
  MEW_HISTORY_MAX,
  MEW_IMAGE_MAX,
  MEW_SEND_MAX,
  MEW_TEXT_MAX,
  type MewActionStatus,
  type MewReply,
  type MewRequest,
  type MewTranscript,
  type ProviderId,
} from "@dailify/shared";
import type { AppEnv, Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getSettings } from "../db/settings";
import { getUndatedTasks, readMonth } from "../db/tasks";
import { aiQuota, debitAi } from "../db/limits";
import { activeIntegrations } from "../db/integrations";
import { claimAction, hasGrant, logProposals, saveGrant, setActionStatus } from "../db/mew";
import { PROVIDERS } from "../integrations/registry";
import { WINDOW_DAYS, agendaOf, askMew, type MewApp } from "../lib/mew";
import { monthsTouching } from "../lib/occurrence-alert";
import { transcribe } from "../lib/openai";
import { parseAudio, readJson, validZone } from "../lib/task-input";
import { fail } from "../lib/errors";

const STATUSES: readonly MewActionStatus[] = ["proposed", "done", "cancelled", "undone"];

const mew = new Hono<AppEnv>();
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
  const p = body.permission;
  const permission =
    isRecord(p) && typeof p.id === "string" && typeof p.always === "boolean"
      ? { id: p.id, always: p.always }
      : undefined;
  if (p !== undefined && !permission) return { error: "invalid permission", status: 400 };
  return { text, timezone, history, ...(image && { image }), ...(permission && { permission }) };
}

/** The connected apps this turn may read from or draft to: the provider implements it. */
const appsOf = (allowed: readonly ProviderId[]): MewApp[] =>
  allowed.flatMap((provider) => {
    const p = PROVIDERS[provider];
    return p.read || p.send
      ? [{ provider, target: p.target ?? "id", read: Boolean(p.read), send: Boolean(p.send) }]
      : [];
  });

async function readFrom(env: Env, userId: string, provider: ProviderId, target: string) {
  const read = PROVIDERS[provider].read;
  if (!read) throw new Error(`${provider} can't read`);
  return { provider, target, text: await read(env, userId, target) };
}

/** Undated tasks plus the months the ±`WINDOW_DAYS` window touches. */
async function readAgenda(db: D1Database, userId: string, timezone: string, now: number) {
  const day = 86_400_000;
  // Two ends 28 days apart touch at most two months.
  const months = monthsTouching(now + WINDOW_DAYS * day, 2 * WINDOW_DAYS * day, timezone);
  const read = await Promise.all([
    getUndatedTasks(db, userId),
    ...months.map((m) => readMonth(db, userId, m, timezone)),
  ]);
  return agendaOf(read.flat(), timezone, now);
}

mew.post("/chat", rateLimit("AI_LIMITER"), async (c) => {
  const userId = c.get("userId");
  const req = parseRequest(await readJson(c));
  if ("error" in req) return fail(c, req.status, req.error);
  if (!(await getSettings(c.env.DB, userId)).mewConsent)
    return fail(c, 403, MEW_CONSENT_REQUIRED, { code: API_ERROR.mewConsentRequired });
  // The turn's credit went with the reply that asked permission; the single-use claim below is
  // what keeps the re-sent half from being free AI calls.
  const quota = req.permission ? null : await aiQuota(c.env.DB, userId, c.get("plan"));
  if (quota) return fail(c, quota.status, quota.error, { code: quota.code });

  const db = c.env.DB;
  const now = Date.now();
  const [agenda, active] = await Promise.all([
    readAgenda(db, userId, req.timezone, now),
    activeIntegrations(db, userId, c.get("plan")),
  ]);
  const allowed = active.filter((id) => INTEGRATIONS[id].tasks);
  const apps = appsOf(active);

  const answer = req.permission;
  const claimed = answer && (await claimAction(db, userId, answer.id, "read"));
  if (answer) {
    if (!claimed) return fail(c, 404, "Permission not found");
    if (!apps.some((a) => a.provider === claimed.provider && a.read)) {
      await setActionStatus(db, userId, answer.id, "cancelled");
      return fail(c, 404, "Permission not found");
    }
    if (answer.always) await saveGrant(db, userId, claimed.provider, "read", now);
  }

  let reply: MewReply;
  try {
    if (claimed) {
      const read = await readFrom(c.env, userId, claimed.provider, claimed.target);
      reply = await askMew(c.env, req, agenda, allowed, apps, read);
    } else {
      reply = await askMew(c.env, req, agenda, allowed, apps);
      const ask = reply.blocks.find((b) => b.kind === "permission");
      if (ask && (await hasGrant(db, userId, ask.provider, ask.capability))) {
        const read = await readFrom(c.env, userId, ask.provider, ask.target);
        reply = await askMew(c.env, req, agenda, allowed, apps, read);
      }
    }
  } catch (err) {
    console.error(err);
    if (answer) await setActionStatus(db, userId, answer.id, "proposed");
    return fail(c, 502, "AI request failed");
  }
  if (!answer) await debitAi(db, userId);
  await logProposals(db, userId, reply.blocks, now);
  return c.json(reply);
});

// The chat's mic: the transcript comes back and goes out as a normal `/chat` turn, which debits.
// ponytail: transcription alone is free, bounded by AI_LIMITER (6/min) and a non-empty quota;
// fold the audio into `/chat` if that ever shows up in the OpenAI bill.
mew.post("/transcribe", rateLimit("AI_LIMITER"), async (c) => {
  const userId = c.get("userId");
  if (!(await getSettings(c.env.DB, userId)).mewConsent)
    return fail(c, 403, MEW_CONSENT_REQUIRED, { code: API_ERROR.mewConsentRequired });
  const quota = await aiQuota(c.env.DB, userId, c.get("plan"));
  if (quota) return fail(c, quota.status, quota.error, { code: quota.code });
  const audio = parseAudio((await c.req.parseBody())["audio"]);
  if ("error" in audio) return fail(c, audio.status, audio.error);
  try {
    const text = (await transcribe(c.env, audio)).trim().slice(0, MEW_TEXT_MAX);
    return c.json({ text } satisfies MewTranscript);
  } catch (err) {
    console.error(err);
    return fail(c, 502, "AI request failed");
  }
});

// A confirmed `send` box: the text may be the user's edit, the address is the stored one.
mew.post("/actions/:id/send", rateLimit("API_LIMITER"), async (c) => {
  const body = await readJson(c);
  const text = isRecord(body) && typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MEW_SEND_MAX) return fail(c, 400, "invalid text");
  const db = c.env.DB;
  const userId = c.get("userId");
  const id = c.req.param("id");
  const claimed = await claimAction(db, userId, id, "send");
  if (!claimed) return fail(c, 404, "Action not found");
  const active = await activeIntegrations(db, userId, c.get("plan"));
  const send = active.includes(claimed.provider) ? PROVIDERS[claimed.provider].send : undefined;
  if (!send) {
    await setActionStatus(db, userId, id, "proposed");
    return fail(c, 409, "Reconnect the app", { code: API_ERROR.reconnect });
  }
  try {
    await send(c.env, userId, claimed.target, text);
  } catch (err) {
    console.error(err);
    await setActionStatus(db, userId, id, "proposed");
    return fail(c, 502, "Send failed");
  }
  return c.body(null, 204);
});

mew.patch("/actions/:id", rateLimit("API_LIMITER"), async (c) => {
  const body = await readJson(c);
  const status = isRecord(body) ? STATUSES.find((s) => s === body.status) : undefined;
  if (!status) return fail(c, 400, "invalid status");
  const found = await setActionStatus(c.env.DB, c.get("userId"), c.req.param("id"), status);
  return found ? c.body(null, 204) : fail(c, 404, "Action not found");
});

export default mew;
