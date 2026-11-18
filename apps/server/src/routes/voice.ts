import { Hono } from "hono";
import { TZDate } from "@date-fns/tz";
import { TASK_LIMITS, parseTaskText, type AiParse, type Role, type Task } from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getSettings } from "../db/settings";
import { draftToTask, interpretText, transcribe } from "../lib/openai";
import { insertTask } from "../db/tasks";
import { aiQuotaError, debitAi, enforceCreate } from "../db/limits";
import { aiTargets } from "../db/integrations";
import { fail } from "../lib/errors";
import { validZone } from "../lib/task-input";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const voice = new Hono<{ Bindings: Env; Variables: { userId: string; plan: Role } }>();

/** Frase clara (sem `unsure`) o parser lê sozinho; o GPT só entra na dúvida. */
function readLocally(text: string, timezone: string): AiParse | null {
  const parsed = parseTaskText(text, new TZDate(Date.now(), timezone));
  if (parsed.unsure.length || !parsed.text) return null;
  const { date, hasTime, hasDay, duration, links, repeat, repeatEvery } = parsed;
  const draft = {
    text: parsed.text,
    date: date?.getTime() ?? null,
    hasTime,
    hasDay,
    duration,
    links,
    repeat,
    repeatEvery,
  };
  return { reply: "Anotei!", intent: "create", drafts: [draft] };
}

voice.post("/parse", requireAuth, rateLimit("VOICE_LIMITER"), async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const text = isRecord(body) && typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > TASK_LIMITS.titleMax) return fail(c, 400, "invalid text");
  const timezone = validZone(isRecord(body) ? body.timezone : undefined);
  if (!timezone) return fail(c, 400, "invalid timezone");

  const quotaError = await aiQuotaError(c);
  if (quotaError) return quotaError;
  const allowed = await aiTargets(c.env.DB, c.get("userId"), c.get("plan"));

  let result: AiParse;
  try {
    result = await interpretText(c.env, text, timezone, allowed);
  } catch (err) {
    console.error(err);
    return fail(c, 502, "AI request failed");
  }
  await debitAi(c);
  return c.json(result);
});

voice.post("/voice", requireAuth, rateLimit("VOICE_LIMITER"), async (c) => {
  const userId = c.get("userId");
  const quotaError = await aiQuotaError(c);
  if (quotaError) return quotaError;

  const body = await c.req.parseBody();
  const audio = body["audio"];
  if (!(audio instanceof File)) return fail(c, 400, "No audio");

  // 60s a 24 kbps = ~180 KB; 512 KB dá folga pro AAC do Safari. Este é o teto de custo por comando:
  // a transcrição é cobrada por minuto de áudio, e sem ele um upload cabia ~28 minutos.
  // ponytail: byte é proxy de duração. Uma request forjada pode encodar ~8 min a 8 kbps aqui
  // dentro; quem fecha a conta é a quota mensal, não este cap sozinho.
  const MAX_AUDIO_BYTES = 512 * 1024;
  if (audio.size > MAX_AUDIO_BYTES) return fail(c, 413, "Audio too large (max 512KB)");
  if (audio.type && !audio.type.startsWith("audio/")) return fail(c, 415, "Unsupported audio type");

  const timezone =
    validZone(body["timezone"]) ?? validZone((await getSettings(c.env.DB, userId)).timeZone);
  if (!timezone) return fail(c, 400, "No timezone set");

  // Transcrição (+ leitura do GPT, se o parser local ficou em dúvida) = um crédito, debitado só
  // quando tudo deu certo.
  let ai: AiParse;
  try {
    const transcript = await transcribe(c.env, audio);
    // A voz cria sem confirmação, então não recebe destino: nada de `targets` nesta fase.
    ai =
      readLocally(transcript, timezone) ?? (await interpretText(c.env, transcript, timezone, []));
  } catch (err) {
    console.error(err);
    return fail(c, 502, "AI request failed");
  }
  await debitAi(c);

  const now = Date.now();
  const tasks: Task[] = [];
  for (const draft of ai.drafts) {
    const task = draftToTask(draft, timezone, now);
    const err = await enforceCreate(c.env.DB, userId, c.get("plan"), task);
    if (err) return fail(c, 429, err);

    await insertTask(c.env.DB, userId, task);
    tasks.push(task);
  }

  return c.json({ response: ai.reply, tasks });
});

export default voice;
