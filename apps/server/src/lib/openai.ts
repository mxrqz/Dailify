import OpenAI from "openai";
import { DateTime } from "luxon";
import { nanoid } from "nanoid";
import { TZDate } from "@date-fns/tz";
import {
  composeTaskInput,
  DATE_RANGE,
  INTEGRATIONS,
  PROVIDER_IDS,
  TASK_LIMITS,
  normalizeRepeat,
  weekDays,
  type AiIntent,
  type AiParse,
  type ParsedTaskWire,
  type ProviderId,
  type Task,
} from "@dailify/shared";
import type { Env } from "../index";
import { isRepeatEvery, sanitizeLinks } from "./task-input";

// One retry: the SDK retries timeouts too, so the default 2 turned each `timeout` into 3× it.
export const openaiClient = (env: Env) => new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 1 });

// gpt-4o-mini shuts down 2027-01-14. Luna reasons; "low" keeps the composer snappy.
const MODEL = "gpt-6-luna";

// gpt-4o-mini-transcribe shuts down 2027-02-26; gpt-transcribe is OpenAI's listed successor.
// Billing is per audio DURATION, not file size — the client keeps clips short + Opus-compressed.
export async function transcribe(env: Env, file: File): Promise<string> {
  const r = await openaiClient(env).audio.transcriptions.create(
    { file, model: "gpt-transcribe" },
    { timeout: 20_000 },
  );
  return r.text;
}

export interface GPTTask {
  title: string;
  date: string | null;
  duration: string | null;
  repeat: unknown;
  repeatEvery?: unknown;
  links: string[];
  targets?: GPTTarget[];
}

interface GPTTarget {
  provider: string;
  meet: boolean;
}

interface GPTResponse {
  intent: AiIntent;
  reply: string;
  tasks: GPTTask[];
}

const INTENTS: readonly string[] = ["create", "question", "command", "unsupported"];

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

const isNullableString = (v: unknown) => v === null || typeof v === "string";

const isGPTTarget = (v: unknown): v is GPTTarget =>
  isRecord(v) && typeof v.provider === "string" && typeof v.meet === "boolean";

export function isGPTTask(v: unknown): v is GPTTask {
  return (
    isRecord(v) &&
    typeof v.title === "string" &&
    isNullableString(v.date) &&
    isNullableString(v.duration) &&
    isStringArray(v.links) &&
    (v.targets === undefined || (Array.isArray(v.targets) && v.targets.every(isGPTTarget)))
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
// continua sendo a porta — mock, modelo trocado ou schema ignorado não passam dele. `targets` só
// aceita as integrações desta pessoa: sem nenhuma, `maxItems: 0` (enum vazio não é schema válido).
export const taskSchema = (allowed: readonly ProviderId[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["title", "date", "duration", "repeat", "repeatEvery", "links", "targets"],
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
    targets: {
      type: "array",
      maxItems: allowed.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["provider", "meet"],
        properties: {
          provider: { type: "string", enum: allowed.length ? allowed : PROVIDER_IDS },
          meet: { type: "boolean" },
        },
      },
    },
  },
});

const schema = (allowed: readonly ProviderId[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["intent", "reply", "tasks"],
  properties: {
    intent: { type: "string", enum: INTENTS },
    reply: { type: "string" },
    tasks: { type: "array", items: taskSchema(allowed) },
  },
});

// `now` vai em hora LOCAL ingênua (sem offset) e as datas voltam assim também: o servidor as
// reinterpreta no fuso do cliente (`toEpoch`). Deixar a IA fazer a conta do offset abriria a porta
// pra conversão dupla.
export const PERSONA = `Você é a Mewki — "Mew" pros íntimos —, a gatinha assistente do app de tarefas Mewki. Fale sempre no
feminino ("anotei", "pronto, marquei"), em português do Brasil. Se o usuário escrever em inglês,
responda em inglês.`;

export function clock(timezone: string): string {
  const local = DateTime.now().setZone(timezone);
  const now = local.toISO({ includeOffset: false, suppressMilliseconds: true }) ?? "";
  return `Agora é ${now} (${weekDays[local.weekday % 7]}), no horário local do usuário. Use isso para "amanhã", "sexta",
"daqui a 30 minutos", "15 pras 6" (= 05:45 ou 17:45, o que vier primeiro), etc.`;
}

export const taskRules = (
  allowed: readonly ProviderId[],
) => `- "title": curto, na língua do usuário, sem data, hora, duração, recorrência nem link. Mantenha nomes próprios.
- "date": hora LOCAL, sem 'Z' e sem offset. "YYYY-MM-DDTHH:mm:ss" se o usuário disse a hora;
  "YYYY-MM-DD" se disse só o dia; null se não disse nem dia nem hora. Nunca invente hora.
  Hora sem dia: hoje se ainda não passou, senão amanhã. Recorrente: a próxima ocorrência.
- "duration": só se dita, no formato "15m", "1h", "1h30m" (nunca "min"); senão null.
- "repeat": só se dita explicitamente — "Off" | "Daily" | "Monthly" | "Yearly" |
  {"Weekly": ["Monday", ...]} (nomes em inglês); senão "Off".
- "repeatEvery": o N de "a cada N" (2 a 365) na unidade do "repeat" — "a cada 2 semanas" é Weekly
  com 2, "dia sim, dia não" é Daily com 2, "a cada 3 meses" é Monthly com 3; senão null.
- "links": as URLs citadas, exatamente como vieram; [] se nenhuma.
${targetsRule(allowed)}`;

const PROMPT = (timezone: string, allowed: readonly ProviderId[]) => `
${PERSONA}

${clock(timezone)}

Classifique o pedido em "intent":
- "create": quer anotar uma ou mais tarefas, lembretes ou compromissos.
- "question": pergunta sobre a agenda ou as tarefas ("o que tenho amanhã?").
- "command": quer mudar, apagar, concluir ou mover algo que já existe.
- "unsupported": qualquer outra coisa.
Você só cria tarefas. Fora de "create", "tasks" é [] e "reply" diz, com carinho, que por enquanto
você só anota tarefas novas.

Cada item de "tasks":
${taskRules(allowed)}
Várias tarefas no mesmo pedido viram vários itens. Não invente prioridade, alerta nem tags.

"reply": uma frase curta na sua voz, sem markdown (ex.: "Anotei! Reunião amanhã às 14h 🐾").
`;

// Você só sugere: o app mostra o destino ligado e a pessoa confirma antes de qualquer coisa sair.
function targetsRule(allowed: readonly ProviderId[]): string {
  if (!allowed.length) return `- "targets": sempre [] (nenhum app conectado).`;
  const list = allowed.map((id) => `${INTEGRATIONS[id].name} ("${id}")`).join(", ");
  return `- "targets": Integrações conectadas: ${list}. Só inclua uma quando o usuário pedir com
  todas as letras pra pôr a tarefa naquele app ("coloca no Google Agenda", "add to my calendar",
  "marca no calendar"); citar o app como assunto ("revisar a API do Google Calendar") não conta.
  "meet": true só se ele pedir link de Meet/videochamada; senão false. Sem pedido, [].
  Nunca deixe o nome do app ou o pedido de colocar nele no "title".`;
}

const DURATION_RE = /^(?:\d{1,3}h)?(?:\d{1,4}m)?$/;
export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "1h30min" → "1h30m"; o que não couber no formato do `Task.duration` vira `null`. */
function toDuration(raw: string | null): string | null {
  const d = raw?.toLowerCase().replace(/\s+/g, "").replace(/min$/, "m");
  return d && DURATION_RE.test(d) ? d : null;
}

/** Hora-de-parede local → epoch-ms no fuso do cliente; 'Z'/offset que escapar é ignorado. */
export function toEpoch(iso: string, timeZone: string): number | null {
  const local = iso.replace(/(Z|[+-]\d{2}:?\d{2})$/, "");
  const ms = DateTime.fromISO(local, { zone: timeZone }).toMillis();
  return Number.isFinite(ms) && ms >= DATE_RANGE.min && ms <= DATE_RANGE.max ? ms : null;
}

export function toDraft(
  t: GPTTask,
  timeZone: string,
  allowed: readonly ProviderId[],
): ParsedTaskWire {
  const date = t.date === null ? null : toEpoch(t.date, timeZone);
  if (t.date !== null && date === null) throw new Error("AI returned an invalid date");
  // Link a link: um `javascript:` inventado cai sozinho, sem levar os bons junto.
  const links = t.links
    .filter((l) => Array.isArray(sanitizeLinks([l])))
    .slice(0, TASK_LIMITS.linksMax);
  const repeat = normalizeRepeat(t.repeat);
  // O schema já restringe; isto vale pra quando ele não segurou. Um destino por provider.
  const targets = allowed.flatMap((provider) => {
    const target = t.targets?.find((x) => x.provider === provider);
    return target ? [{ provider, ...(target.meet && { meet: true }) }] : [];
  });
  return {
    text: t.title.trim().slice(0, TASK_LIMITS.titleMax),
    date,
    hasTime: t.date !== null && !DATE_ONLY_RE.test(t.date),
    hasDay: date !== null,
    duration: toDuration(t.duration),
    links,
    repeat,
    repeatEvery: repeat !== "Off" && isRepeatEvery(t.repeatEvery) ? t.repeatEvery : undefined,
    ...(targets.length && { targets }),
  };
}

/** The composer's rule (`composeTaskInput`), with a server id the client can POST back as-is. */
export function draftToTask(d: ParsedTaskWire, timezone: string, now: number): Task {
  const date = d.date === null ? null : new TZDate(d.date, timezone);
  const input = composeTaskInput({ ...d, date }, new TZDate(now, timezone));
  return { ...input, id: nanoid(6), completed: [] };
}

/** Model output through its guard; throws so the caller answers 502 without a debit. */
export function readOutput<T>(text: string, guard: (v: unknown) => v is T): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI returned invalid JSON");
  }
  if (!guard(parsed)) throw new Error("AI returned an unexpected response shape");
  return parsed;
}

/**
 * The one Responses call: strict `json_schema` output through `guard`. Throws on any failure, so
 * the caller answers 502 without a debit.
 */
export async function structured<T>(
  env: Env,
  req: {
    name: string;
    schema: Record<string, unknown>;
    instructions: string;
    input: OpenAI.Responses.ResponseCreateParamsNonStreaming["input"];
    timeout: number;
  },
  guard: (v: unknown) => v is T,
): Promise<T> {
  const result = await openaiClient(env).responses.create(
    {
      model: MODEL,
      reasoning: { effort: "low" },
      // The Responses API keeps outputs 30 days by default; task text has no reason to stay there.
      store: false,
      instructions: req.instructions,
      input: req.input,
      text: { format: { type: "json_schema", name: req.name, strict: true, schema: req.schema } },
    },
    { timeout: req.timeout },
  );
  return readOutput(result.output_text, guard);
}

/**
 * Texto → rascunhos. Porta única da IA de criação: `POST /tasks/parse` e a voz (depois da
 * transcrição) passam por aqui. Lança quando a OpenAI falha ou devolve fora do contrato — e
 * quem chama só debita crédito depois que isto voltou. `allowed`: as integrações ativas que o plano
 * libera — os únicos `targets` que a IA pode sugerir.
 */
export async function interpretText(
  env: Env,
  text: string,
  timezone: string,
  allowed: readonly ProviderId[],
): Promise<AiParse> {
  const parsed = await structured(
    env,
    {
      name: "mewki_parse",
      schema: schema(allowed),
      instructions: PROMPT(timezone, allowed),
      input: text,
      timeout: 20_000,
    },
    isGPTResponse,
  );
  const drafts =
    parsed.intent === "create"
      ? parsed.tasks.map((t) => toDraft(t, timezone, allowed)).filter((d) => d.text)
      : [];
  return { reply: parsed.reply.trim(), intent: parsed.intent, drafts };
}
