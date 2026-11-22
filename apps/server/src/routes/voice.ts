import { Hono } from "hono";
import { TZDate } from "@date-fns/tz";
import { TASK_LIMITS, isRecord, parseTaskText, type AiParse, type Task } from "@dailify/shared";
import type { AppEnv } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getSettings } from "../db/settings";
import { draftToTask, interpretText, transcribe } from "../lib/openai";
import { insertTask } from "../db/tasks";
import { aiQuota, debitAi } from "../db/limits";
import { aiTargets } from "../db/integrations";
import { fail } from "../lib/errors";
import { parseAudio, readJson, validZone } from "../lib/task-input";

const voice = new Hono<AppEnv>();

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

voice.post("/parse", requireAuth, rateLimit("AI_LIMITER"), async (c) => {
  const body = await readJson(c);
  const text = isRecord(body) && typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > TASK_LIMITS.titleMax) return fail(c, 400, "invalid text");
  const timezone = validZone(isRecord(body) ? body.timezone : undefined);
  if (!timezone) return fail(c, 400, "invalid timezone");

  const userId = c.get("userId");
  const quota = await aiQuota(c.env.DB, userId, c.get("plan"));
  if (quota) return fail(c, quota.status, quota.error, { code: quota.code });
  const allowed = await aiTargets(c.env.DB, userId, c.get("plan"));

  let result: AiParse;
  try {
    result = await interpretText(c.env, text, timezone, allowed);
  } catch (err) {
    console.error(err);
    return fail(c, 502, "AI request failed");
  }
  await debitAi(c.env.DB, userId);
  return c.json(result);
});

voice.post("/voice", requireAuth, rateLimit("AI_LIMITER"), async (c) => {
  const userId = c.get("userId");
  const quota = await aiQuota(c.env.DB, userId, c.get("plan"));
  if (quota) return fail(c, quota.status, quota.error, { code: quota.code });

  const body = await c.req.parseBody();
  const audio = parseAudio(body["audio"]);
  if ("error" in audio) return fail(c, audio.status, audio.error);

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
  await debitAi(c.env.DB, userId);

  const now = Date.now();
  const tasks: Task[] = [];
  for (const draft of ai.drafts) {
    const task = draftToTask(draft, timezone, now);
    const stored = await insertTask(c.env.DB, userId, task);
    if (stored) tasks.push(stored);
  }

  return c.json({ response: ai.reply, tasks });
});

export default voice;
