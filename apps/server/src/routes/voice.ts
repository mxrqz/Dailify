import { Hono, type Context } from "hono";
import { nanoid } from "nanoid";
import { IANAZone } from "luxon";
import { TZDate } from "@date-fns/tz";
import type { User } from "@clerk/backend";
import {
  TASK_LIMITS,
  composeTaskInput,
  limitsFor,
  parseTaskText,
  type AiParse,
  type ParsedTaskWire,
  type Task,
} from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { clerk, getUserRole } from "../lib/clerk";
import { interpretText, transcribe } from "../lib/openai";
import { insertTask } from "../db/tasks";
import { enforce, enforceCreate } from "../db/limits";
import { bumpStoredUsage, periodFor } from "../db/usage";
import { fail } from "../lib/errors";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const voice = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

function readTimezone(user: User): string | undefined {
  const tz = user.unsafeMetadata?.timezone;
  return validZone(tz);
}

/** Fuso vindo do cliente: sempre presente (Intl), mas é entrada de usuário — validar antes de usar. */
function validZone(value: unknown): string | undefined {
  return typeof value === "string" && IANAZone.isValidZone(value) ? value : undefined;
}

type Ctx = Context<{ Bindings: Env; Variables: { userId: string } }>;

/** Barra antes de qualquer chamada à OpenAI. Bloqueado (limite 0) e esgotado: sem crédito, 403/429. */
async function aiQuotaError(c: Ctx): Promise<Response | null> {
  const limits = limitsFor(await getUserRole(c.env, c.get("userId")));
  const err = await enforce(c.env.DB, c.get("userId"), limits, "ai", new Date());
  return err ? fail(c, limits.ai === 0 ? 403 : 429, err) : null;
}

/** Crédito só depois da IA responder dentro do contrato: falha, timeout ou lixo não custam nada. */
const debitAi = (c: Ctx) =>
  bumpStoredUsage(c.env.DB, c.get("userId"), "ai", periodFor("ai", new Date()));

/** A voz cria direto, sem confirmação: mesma regra do composer do web (`composeTaskInput`). */
function draftToTask(d: ParsedTaskWire, timezone: string, now: number): Task {
  const date = d.date === null ? null : new TZDate(d.date, timezone);
  const input = composeTaskInput({ ...d, date }, new TZDate(now, timezone));
  return { ...input, id: nanoid(6), completed: [] };
}

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

  let result: AiParse;
  try {
    result = await interpretText(c.env, text, timezone);
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

  const user = await clerk(c.env).users.getUser(userId);
  const timezone = validZone(body["timezone"]) ?? readTimezone(user);
  if (!timezone) return fail(c, 400, "No timezone set");

  // Transcrição (+ leitura do GPT, se o parser local ficou em dúvida) = um crédito, debitado só
  // quando tudo deu certo.
  let ai: AiParse;
  try {
    const transcript = await transcribe(c.env, audio);
    ai = readLocally(transcript, timezone) ?? (await interpretText(c.env, transcript, timezone));
  } catch (err) {
    console.error(err);
    return fail(c, 502, "AI request failed");
  }
  await debitAi(c);

  const now = Date.now();
  const tasks: Task[] = [];
  for (const draft of ai.drafts) {
    const task = draftToTask(draft, timezone, now);
    const err = await enforceCreate(c.env, userId, task);
    if (err) return fail(c, 429, err);

    await insertTask(c.env.DB, userId, task);
    tasks.push(task);
  }

  return c.json({ response: ai.reply, tasks });
});

export default voice;
