import { nanoid } from "nanoid";
import {
  DATE_RANGE,
  TASK_LIMITS,
  isRecord,
  isRepeatEvery,
  isTimeZone,
  normalizeRepeat,
  parseMonthKey,
  type Task,
} from "@dailify/shared";
import { base64urlToBytes, bytesToBase64url } from "./encoding";

/** Fuso vindo do cliente: sempre presente (Intl), mas é entrada de usuário — validar antes de usar. */
export function validZone(value: unknown): string | undefined {
  return isTimeZone(value) ? value : undefined;
}

/** The JSON body as `unknown`, never throwing: empty or malformed becomes `undefined` (a 400). */
export async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

// 60s a 24 kbps = ~180 KB; 512 KB dá folga pro AAC do Safari. Este é o teto de custo por comando:
// a transcrição é cobrada por minuto de áudio, e sem ele um upload cabia ~28 minutos.
// ponytail: byte é proxy de duração. Uma request forjada pode encodar ~8 min a 8 kbps aqui
// dentro; quem fecha a conta é a quota mensal, não este cap sozinho.
const MAX_AUDIO_BYTES = 512 * 1024;

/** The multipart `audio` part, checked before anything pays to transcribe it. */
export function parseAudio(value: unknown): File | { error: string; status: 400 | 413 | 415 } {
  if (!(value instanceof File)) return { error: "No audio", status: 400 };
  if (value.size > MAX_AUDIO_BYTES) return { error: "Audio too large (max 512KB)", status: 413 };
  if (value.type && !value.type.startsWith("audio/"))
    return { error: "Unsupported audio type", status: 415 };
  return value;
}

/** "YYYY-MM" with month 1..12 -> the 1st of that month; anything else -> null. */
export function parseMonth(value: string | undefined): Date | null {
  const key = value === undefined ? null : parseMonthKey(value);
  // Only the year/month pair is read later; every epoch goes through the user's zone.
  return key && new Date(key.year, key.month, 1);
}

/** `?occurrence=<epoch-ms>`: absent -> undefined, non-integer or outside `DATE_RANGE` -> "invalid". */
export function parseOccurrence(raw: string | undefined): number | undefined | "invalid" {
  if (raw === undefined) return undefined;
  const at = Number(raw);
  return isEpochMs(at) ? at : "invalid";
}

/** The GET /tasks/sync cursor: `v1.<epoch-ms>` in base64url, opaque so clients never do math on it. */
export const encodeCursor = (at: number): string =>
  bytesToBase64url(new TextEncoder().encode(`v1.${at}`));

/** `?since=`: absent or anything malformed -> undefined, which the pull answers in full. */
export function parseCursor(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  try {
    const m = /^v1\.(\d{1,16})$/.exec(new TextDecoder().decode(base64urlToBytes(raw)));
    return m ? Number(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

/** Campos que o cliente pode ditar. `id`, `completed` e `exdates` são do servidor, nunca do body. */
export type TaskFields = Partial<Omit<Task, "id" | "completed" | "exdates">>;

// Os tetos vivem em `@dailify/shared` porque o formulario precisa da MESMA regua: enquanto eram
// locais, o cliente oferecia mais do que esta porta aceita.
const {
  titleMax: MAX_TITLE_LEN,
  durationMax: MAX_DURATION_LEN,
  tagsMax: MAX_TAGS,
  tagMax: MAX_TAG_LEN,
  linksMax: MAX_LINKS,
  urlMax: MAX_URL_LEN,
} = TASK_LIMITS;
const { min: MIN_DATE, max: MAX_DATE } = DATE_RANGE;

export function isEpochMs(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= MIN_DATE && value <= MAX_DATE
  );
}

// `undefined` = campo nao veio (ou veio null); "invalid" = veio e nao presta pra nada.
// So http(s) passa porque `javascript:`/`data:` num `<a href>` do cliente e XSS; `username`/
// `password` sao recusados porque "paypal.com@evil.com" se disfarca de dominio confiavel.
export function sanitizeLinks(value: unknown): string[] | undefined | "invalid" {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_LINKS) return "invalid";

  const urls: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length > MAX_URL_LEN || !URL.canParse(item))
      return "invalid";
    const { protocol, username, password } = new URL(item);
    if (protocol !== "http:" && protocol !== "https:") return "invalid";
    if (username || password) return "invalid";
    urls.push(item);
  }
  return urls.length ? urls : undefined;
}

function sanitizeTags(value: unknown): string[] | undefined | "invalid" {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_TAGS) return "invalid";

  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length > MAX_TAG_LEN) return "invalid";
    const tag = item.trim();
    if (tag) tags.push(tag);
  }
  return tags.length ? tags : undefined;
}

export type ParseResult = { error: string } | { fields: TaskFields };

/**
 * Porta única dos campos vindos do cliente — POST e PATCH passam por aqui. Sem isso um `title`
 * ausente vira violação de NOT NULL do D1: 500 cru no lugar de 400.
 */
export function parseTaskFields(body: unknown, opts: { partial: boolean }): ParseResult {
  if (!isRecord(body)) return { error: "invalid body" };
  const fields: TaskFields = {};

  const title = body.title;
  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim() || title.length > MAX_TITLE_LEN)
      return { error: "invalid title" };
    fields.title = title.trim();
  } else if (!opts.partial) return { error: "title required" };

  const date = body.date;
  if (date !== undefined) {
    if (!isEpochMs(date)) return { error: "invalid date" };
    fields.date = date;
  } else if (!opts.partial) return { error: "date required" };

  // `null` limpa o lembrete (mesmo truque das tags: `undefined` presente sobrescreve no spread).
  const alert = body.alert;
  if (alert === null) fields.alert = undefined;
  else if (alert !== undefined) {
    if (!isEpochMs(alert)) return { error: "invalid alert" };
    fields.alert = alert;
  }

  const duration = body.duration;
  if (duration !== undefined) {
    if (typeof duration !== "string" || duration.length > MAX_DURATION_LEN)
      return { error: "invalid duration" };
    fields.duration = duration;
  }

  const priority = body.priority;
  if (priority !== undefined) {
    if (
      typeof priority !== "number" ||
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > TASK_LIMITS.priorityMax
    )
      return { error: "invalid priority" };
    fields.priority = priority;
  }

  const repeat = body.repeat;
  if (repeat !== undefined) fields.repeat = normalizeRepeat(repeat);

  // `null` volta a 1 (mesmo truque do `alert`).
  const repeatEvery = body.repeatEvery;
  if (repeatEvery === null) fields.repeatEvery = undefined;
  else if (repeatEvery !== undefined) {
    if (!isRepeatEvery(repeatEvery)) return { error: "invalid repeatEvery" };
    fields.repeatEvery = repeatEvery;
  }

  // Chave presente com lista vazia (ou null) = limpar o campo, e por isso o `!== undefined` olha o
  // valor cru: `fields.tags = undefined` sobrescreve no spread do updateTask, a chave ausente nao.
  const rawTags = body.tags;
  const tags = sanitizeTags(rawTags);
  if (tags === "invalid") return { error: "invalid tags" };
  if (rawTags !== undefined) fields.tags = tags;

  const rawLinks = body.links;
  const links = sanitizeLinks(rawLinks);
  if (links === "invalid") return { error: "invalid links" };
  if (rawLinks !== undefined) fields.links = links;

  const undated = body.undated;
  if (undated !== undefined && undated !== null) {
    if (typeof undated !== "boolean") return { error: "invalid undated" };
    fields.undated = undated;
  }

  // O carimbo do LWW vem do cliente (a edição offline aconteceu quando ele diz) e precisa
  // atravessar esta porta — sem isso a fila sobe sem `updatedAt` e toda reentrada vira escrita.
  // `stampUpdatedAt` no db é quem recusa relógio adiantado; aqui só se checa que é epoch-ms.
  const updatedAt = body.updatedAt;
  if (updatedAt !== undefined && updatedAt !== null) {
    if (!isEpochMs(updatedAt)) return { error: "invalid updatedAt" };
    fields.updatedAt = updatedAt;
  }

  return { fields };
}

// Id do cliente: a fila offline precisa que a tarefa mantenha na subida o id com que já apareceu
// na tela — senão o reenvio cria uma cópia. Só o FORMATO se valida aqui; quem impede que um id de
// outra conta seja sobrescrito é o `WHERE user_id` do upsert (`db/tasks.ts`).
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

/** A server-minted task id; it passes `ID_RE`, so the client can POST it back as-is. */
export const newTaskId = (): string => nanoid(6);

export function parseClientId(body: unknown): string | undefined | "invalid" {
  if (!isRecord(body)) return undefined;
  const id = body.id;
  if (id === undefined || id === null) return undefined;
  return typeof id === "string" && ID_RE.test(id) ? id : "invalid";
}

/** Task nova a partir do body. `completed` vindo do cliente é ignorado de propósito. */
export function parseNewTask(body: unknown): { error: string } | { task: Omit<Task, "id"> } {
  const parsed = parseTaskFields(body, { partial: false });
  if ("error" in parsed) return parsed;

  const { title, date, ...rest } = parsed.fields;
  // Redundante em runtime (partial:false já exigiu os dois) — é o que estreita o tipo sem `!`.
  if (title === undefined || date === undefined) return { error: "invalid body" };

  return {
    task: { title, date, duration: "", priority: 0, repeat: "Off", ...rest, completed: [] },
  };
}
