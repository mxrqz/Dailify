import OpenAI from "openai";
import { DateTime } from "luxon";
import {
  DATE_RANGE,
  TASK_LIMITS,
  normalizeRepeat,
  weekDays,
  type AiIntent,
  type AiParse,
  type ParsedTaskWire,
} from "@dailify/shared";
import type { Env } from "../index";
import { isRepeatEvery, sanitizeLinks } from "./task-input";

export const openaiClient = (env: Env) => new OpenAI({ apiKey: env.OPENAI_API_KEY });

// gpt-4o-mini-transcribe: ~$0.003/min (half of whisper-1) with equal/better accuracy.
// Billing is per audio DURATION, not file size — the client keeps clips short + Opus-compressed.
export async function transcribe(env: Env, file: File): Promise<string> {
  const r = await openaiClient(env).audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
  });
  return r.text;
}

interface GPTTask {
  title: string;
  date: string | null;
  duration: string | null;
  repeat: unknown;
  repeatEvery?: unknown;
  links: string[];
}

interface GPTResponse {
  intent: AiIntent;
  reply: string;
  tasks: GPTTask[];
}

const INTENTS: readonly string[] = ["create", "question", "command", "unsupported"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

const isNullableString = (v: unknown) => v === null || typeof v === "string";

function isGPTTask(v: unknown): v is GPTTask {
  return (
    isRecord(v) &&
    typeof v.title === "string" &&
    isNullableString(v.date) &&
    isNullableString(v.duration) &&
    isStringArray(v.links)
  );
}

function isIntent(v: unknown): v is AiIntent {
  return typeof v === "string" && INTENTS.includes(v);
}

// Untrusted: this is parsed straight out of the model's JSON output.
function isGPTResponse(v: unknown): v is GPTResponse {
  return (
    isRecord(v) &&
    isIntent(v.intent) &&
    typeof v.reply === "string" &&
    Array.isArray(v.tasks) &&
    v.tasks.every(isGPTTask)
  );
}

// O mesmo contrato em JSON Schema: com `strict` a OpenAI já devolve neste formato, e o guard acima
// continua sendo a porta — mock, modelo trocado ou schema ignorado não passam dele.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "reply", "tasks"],
  properties: {
    intent: { type: "string", enum: INTENTS },
    reply: { type: "string" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "date", "duration", "repeat", "repeatEvery", "links"],
        properties: {
          title: { type: "string" },
          date: { type: ["string", "null"] },
          duration: { type: ["string", "null"] },
          repeat: {
            anyOf: [
              { type: "string", enum: ["Off", "Daily", "Monthly", "Yearly"] },
              {
                type: "object",
                additionalProperties: false,
                required: ["Weekly"],
                properties: {
                  Weekly: {
                    type: "array",
                    items: { type: "string", enum: weekDays },
                  },
                },
              },
            ],
          },
          repeatEvery: { type: ["integer", "null"] },
          links: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

// `now` vai em hora LOCAL ingênua (sem offset) e as datas voltam assim também: o servidor as
// reinterpreta no fuso do cliente (`toEpoch`). Deixar a IA fazer a conta do offset abriria a porta
// pra conversão dupla.
const PROMPT = (now: string, weekday: string) => `
Você é a Mewki — "Mew" pros íntimos —, a gatinha assistente do app de tarefas Mewki. Fale sempre no
feminino ("anotei", "pronto, marquei"), em português do Brasil. Se o usuário escrever em inglês,
responda em inglês.

Agora é ${now} (${weekday}), no horário local do usuário. Use isso para "amanhã", "sexta",
"daqui a 30 minutos", "15 pras 6" (= 05:45 ou 17:45, o que vier primeiro), etc.

Classifique o pedido em "intent":
- "create": quer anotar uma ou mais tarefas, lembretes ou compromissos.
- "question": pergunta sobre a agenda ou as tarefas ("o que tenho amanhã?").
- "command": quer mudar, apagar, concluir ou mover algo que já existe.
- "unsupported": qualquer outra coisa.
Você só cria tarefas. Fora de "create", "tasks" é [] e "reply" diz, com carinho, que por enquanto
você só anota tarefas novas.

Cada item de "tasks":
- "title": curto, na língua do usuário, sem data, hora, duração, recorrência nem link. Mantenha nomes próprios.
- "date": hora LOCAL, sem 'Z' e sem offset. "YYYY-MM-DDTHH:mm:ss" se o usuário disse a hora;
  "YYYY-MM-DD" se disse só o dia; null se não disse nem dia nem hora. Nunca invente hora.
  Hora sem dia: hoje se ainda não passou, senão amanhã. Recorrente: a próxima ocorrência.
- "duration": só se dita, no formato "15m", "1h", "1h30m" (nunca "min"); senão null.
- "repeat": só se dita explicitamente — "Off" | "Daily" | "Monthly" | "Yearly" |
  {"Weekly": ["Monday", ...]} (nomes em inglês); senão "Off".
- "repeatEvery": o N de "a cada N" (2 a 365) na unidade do "repeat" — "a cada 2 semanas" é Weekly
  com 2, "dia sim, dia não" é Daily com 2, "a cada 3 meses" é Monthly com 3; senão null.
- "links": as URLs citadas, exatamente como vieram; [] se nenhuma.
Várias tarefas no mesmo pedido viram vários itens. Não invente prioridade, alerta nem tags.

"reply": uma frase curta na sua voz, sem markdown (ex.: "Anotei! Reunião amanhã às 14h 🐾").
`;

const DURATION_RE = /^(?:\d{1,3}h)?(?:\d{1,4}m)?$/;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "1h30min" → "1h30m"; o que não couber no formato do `Task.duration` vira `null`. */
function toDuration(raw: string | null): string | null {
  const d = raw?.toLowerCase().replace(/\s+/g, "").replace(/min$/, "m");
  return d && DURATION_RE.test(d) ? d : null;
}

/** Hora-de-parede local → epoch-ms no fuso do cliente; 'Z'/offset que escapar é ignorado. */
function toEpoch(iso: string, timeZone: string): number | null {
  const local = iso.replace(/(Z|[+-]\d{2}:?\d{2})$/, "");
  const ms = DateTime.fromISO(local, { zone: timeZone }).toMillis();
  return Number.isFinite(ms) && ms >= DATE_RANGE.min && ms <= DATE_RANGE.max ? ms : null;
}

function toDraft(t: GPTTask, timeZone: string): ParsedTaskWire {
  const date = t.date === null ? null : toEpoch(t.date, timeZone);
  if (t.date !== null && date === null) throw new Error("AI returned an invalid date");
  // Link a link: um `javascript:` inventado cai sozinho, sem levar os bons junto.
  const links = t.links
    .flatMap((l) => sanitizeLinks([l]) ?? [])
    .filter((l) => l !== "invalid")
    .slice(0, TASK_LIMITS.linksMax);
  const repeat = normalizeRepeat(t.repeat);
  return {
    text: t.title.trim().slice(0, TASK_LIMITS.titleMax),
    date,
    hasTime: t.date !== null && !DATE_ONLY_RE.test(t.date),
    hasDay: date !== null,
    duration: toDuration(t.duration),
    links,
    repeat,
    repeatEvery: repeat !== "Off" && isRepeatEvery(t.repeatEvery) ? t.repeatEvery : undefined,
  };
}

/**
 * Texto → rascunhos. Porta única da IA de criação: `POST /tasks/parse` e a voz (depois da
 * transcrição) passam por aqui. Lança quando a OpenAI falha ou devolve fora do contrato — e
 * quem chama só debita crédito depois que isto voltou.
 */
export async function interpretText(env: Env, text: string, timezone: string): Promise<AiParse> {
  const local = DateTime.now().setZone(timezone);
  const result = await openaiClient(env).responses.create(
    {
      model: "gpt-4o-mini",
      instructions: PROMPT(
        local.toISO({ includeOffset: false, suppressMilliseconds: true }) ?? "",
        weekDays[local.weekday % 7],
      ),
      input: text,
      text: {
        format: {
          type: "json_schema",
          name: "mewki_parse",
          strict: true,
          schema: SCHEMA,
        },
      },
    },
    { timeout: 20_000 },
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.output_text);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  if (!isGPTResponse(parsed)) throw new Error("AI returned an unexpected response shape");

  const drafts =
    parsed.intent === "create"
      ? parsed.tasks.map((t) => toDraft(t, timezone)).filter((d) => d.text)
      : [];
  return { reply: parsed.reply.trim(), intent: parsed.intent, drafts };
}
