import { DATE_RANGE, TASK_LIMITS, normalizeRepeat, type Task } from "@dailify/shared";

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

const field = (o: object, k: string): unknown => Reflect.get(o, k);

function isEpochMs(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= MIN_DATE && value <= MAX_DATE
  );
}

// `undefined` = campo nao veio (ou veio null); "invalid" = veio e nao presta pra nada.
// So http(s) passa porque `javascript:`/`data:` num `<a href>` do cliente e XSS; `username`/
// `password` sao recusados porque "paypal.com@evil.com" se disfarca de dominio confiavel.
function sanitizeLinks(value: unknown): string[] | undefined | "invalid" {
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
  if (typeof body !== "object" || body === null) return { error: "invalid body" };
  const fields: TaskFields = {};

  const title = field(body, "title");
  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim() || title.length > MAX_TITLE_LEN)
      return { error: "invalid title" };
    fields.title = title.trim();
  } else if (!opts.partial) return { error: "title required" };

  const date = field(body, "date");
  if (date !== undefined) {
    if (!isEpochMs(date)) return { error: "invalid date" };
    fields.date = date;
  } else if (!opts.partial) return { error: "date required" };

  const alert = field(body, "alert");
  if (alert !== undefined && alert !== null) {
    if (!isEpochMs(alert)) return { error: "invalid alert" };
    fields.alert = alert;
  }

  const duration = field(body, "duration");
  if (duration !== undefined) {
    if (typeof duration !== "string" || duration.length > MAX_DURATION_LEN)
      return { error: "invalid duration" };
    fields.duration = duration;
  }

  const priority = field(body, "priority");
  if (priority !== undefined) {
    if (typeof priority !== "number" || !Number.isInteger(priority) || priority < 0 || priority > 4)
      return { error: "invalid priority" };
    fields.priority = priority;
  }

  const repeat = field(body, "repeat");
  if (repeat !== undefined) fields.repeat = normalizeRepeat(repeat);

  // Chave presente com lista vazia (ou null) = limpar o campo, e por isso o `!== undefined` olha o
  // valor cru: `fields.tags = undefined` sobrescreve no spread do updateTask, a chave ausente nao.
  const rawTags = field(body, "tags");
  const tags = sanitizeTags(rawTags);
  if (tags === "invalid") return { error: "invalid tags" };
  if (rawTags !== undefined) fields.tags = tags;

  const rawLinks = field(body, "links");
  const links = sanitizeLinks(rawLinks);
  if (links === "invalid") return { error: "invalid links" };
  if (rawLinks !== undefined) fields.links = links;

  // O carimbo do LWW vem do cliente (a edição offline aconteceu quando ele diz) e precisa
  // atravessar esta porta — sem isso a fila sobe sem `updatedAt` e toda reentrada vira escrita.
  // `stampUpdatedAt` no db é quem recusa relógio adiantado; aqui só se checa que é epoch-ms.
  const updatedAt = field(body, "updatedAt");
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

export function parseClientId(body: unknown): string | undefined | "invalid" {
  if (typeof body !== "object" || body === null) return undefined;
  const id = field(body, "id");
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
