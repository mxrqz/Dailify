import { IANAZone } from "luxon";
import {
  calendarEventPreview,
  INTEGRATION_ERROR,
  TASK_LIMITS,
  zonedEpoch,
  type ExternalEvent,
  type IntegrationLink,
  type Task,
} from "@dailify/shared";
import { getLink, getLinkByExternal, upsertLink, type StoredLink } from "../../db/integrations";
import { getTask, updateTask } from "../../db/tasks";
import { ActionError, type Action, type Ctx, type Provider } from "../types";
import { toEvent, type GoogleEvent } from "./event";

const EVENTS_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const NO_DAY = "Tarefa sem dia não vira evento: escolha um dia antes";

// Só eventos de agendas que a pessoa é dona: sensível, mas sem auditoria CASA (zpq).
const EVENTS = "https://www.googleapis.com/auth/calendar.events.owned";

export interface CreateEventInput {
  taskId: string;
  timeZone: string;
  meet: boolean;
}

async function ownTask(ctx: Ctx, id: string): Promise<Task> {
  const task = await getTask(ctx.env.DB, ctx.userId, id);
  if (!task) throw new ActionError(404, "Tarefa não encontrada");
  return task;
}

const field = (body: unknown, key: string): unknown =>
  typeof body === "object" && body !== null ? Reflect.get(body, key) : undefined;
const text = (body: unknown, key: string): string | undefined => {
  const v = field(body, key);
  return typeof v === "string" ? v : undefined;
};

async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return;
  console.error(`Google Agenda ${res.status}`, await res.text().catch(() => ""));
  throw new ActionError(
    502,
    res.status === 403 || res.status === 429
      ? "A Agenda está limitando os pedidos; tente de novo em alguns minutos"
      : "A Agenda não respondeu; tente de novo",
  );
}

/** Os links novos entram no fim e, se passar do teto, quem sai são os mais antigos do fim. */
async function addLinks(ctx: Ctx, task: Task, added: string[]): Promise<Task> {
  const kept = (task.links ?? []).filter((l) => !added.includes(l));
  const links = [...kept.slice(0, TASK_LIMITS.linksMax - added.length), ...added];
  return (await updateTask(ctx.env.DB, ctx.userId, task.id, { links })) ?? task;
}

/** Insert; 409 = o id já existe (retry depois de o D1 falhar, ou evento apagado que volta). */
async function saveEvent(ctx: Ctx, event: GoogleEvent, meet: boolean) {
  const query = meet ? "?conferenceDataVersion=1" : "";
  const init = (method: string, body: object): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let res = await ctx.api(`${EVENTS_API}${query}`, init("POST", event));
  // PATCH com status confirmado: recupera o que existe e revive o que foi pra lixeira.
  if (res.status === 409)
    res = await ctx.api(
      `${EVENTS_API}/${event.id}${query}`,
      init("PATCH", { ...event, status: "confirmed" }),
    );
  await ensureOk(res);
  const body: unknown = await res.json();
  const htmlLink = text(body, "htmlLink");
  if (!htmlLink) throw new ActionError(502, "A Agenda não respondeu; tente de novo");
  return { htmlLink, hangoutLink: text(body, "hangoutLink") };
}

export const createEvent: Action<CreateEventInput> = {
  name: "create-event",
  kind: "write",
  parse(raw) {
    const field = (k: string) =>
      typeof raw === "object" && raw !== null ? Reflect.get(raw, k) : undefined;
    const taskId = field("taskId");
    const timeZone = field("timezone");
    const meet = field("meet");
    if (typeof taskId !== "string" || !taskId) return { error: "taskId é obrigatório" };
    if (typeof timeZone !== "string" || !IANAZone.isValidZone(timeZone))
      return { error: "Fuso inválido" };
    if (meet !== undefined && typeof meet !== "boolean") return { error: "meet inválido" };
    return { input: { taskId, timeZone, meet: meet === true } };
  },
  async preview(ctx, input) {
    const task = await ownTask(ctx, input.taskId);
    const preview = calendarEventPreview(task, input.timeZone, {
      meet: input.meet,
      now: Date.now(),
    });
    if (!preview) throw new ActionError(400, NO_DAY);
    return preview;
  },
  async run(ctx, input): Promise<{ link: IntegrationLink; task: Task }> {
    const task = await ownTask(ctx, input.taskId);
    const existing = await getLink(ctx.env.DB, ctx.userId, "google-calendar", task.id);
    if (existing)
      throw new ActionError(409, "Esta tarefa já está na Agenda", {
        code: INTEGRATION_ERROR.alreadyLinked,
        link: existing,
        task,
      });
    const event = toEvent(task, input.timeZone, { meet: input.meet });
    if (!event) throw new ActionError(400, NO_DAY);

    const saved = await saveEvent(ctx, event, input.meet);
    const link: IntegrationLink = {
      provider: "google-calendar",
      taskId: task.id,
      externalId: event.id,
      url: saved.htmlLink,
    };
    await upsertLink(ctx.env.DB, ctx.userId, link, input.timeZone, Date.now());
    const added = [saved.htmlLink, saved.hangoutLink].filter((l): l is string => !!l);
    return { link, task: await addLinks(ctx, task, added) };
  },
};

const DAY = 86_400_000;
export const MAX_WINDOW = 62 * DAY;
// ponytail: 4 páginas × 250 = 1000 eventos por janela; agenda mais cheia que isso perde o fim.
const MAX_PAGES = 4;

/** "2026-11-16" → meia-noite no fuso; o `date` do dia inteiro não tem fuso próprio. */
const dayStart = (date: string, timeZone: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return zonedEpoch({ year, month: month - 1, day, hour: 0, minute: 0, second: 0 }, timeZone);
};

function when(raw: unknown, timeZone: string): { at: number; allDay: boolean } | null {
  const date = text(raw, "date");
  if (date) return { at: dayStart(date, timeZone), allDay: true };
  const at = Date.parse(text(raw, "dateTime") ?? "");
  return Number.isNaN(at) ? null : { at, allDay: false };
}

/** Evento cru do Google → `ExternalEvent`; o que não tem início/fim legível fica de fora. */
export function toExternal(raw: unknown, timeZone: string): ExternalEvent | null {
  const id = text(raw, "id");
  const url = text(raw, "htmlLink");
  const start = when(field(raw, "start"), timeZone);
  const end = when(field(raw, "end"), timeZone);
  if (!id || !url || !start || !end || text(raw, "status") === "cancelled") return null;
  const mewkiTaskId = text(field(field(raw, "extendedProperties"), "private"), "mewkiTaskId");
  const meet = text(raw, "hangoutLink");
  return {
    id,
    title: text(raw, "summary") ?? "",
    start: start.at,
    end: end.at,
    allDay: start.allDay,
    url,
    ...(meet && { meet }),
    ...(mewkiTaskId && { mewkiTaskId }),
    ...(text(raw, "recurringEventId") && { recurring: true }),
  };
}

/** A janela visível, lida na hora e não guardada (0xp.8): séries já vêm abertas em ocorrências. */
export async function listEvents(
  ctx: Ctx,
  window: { from: number; to: number; timeZone: string },
): Promise<ExternalEvent[]> {
  const to = Math.min(window.to, window.from + MAX_WINDOW);
  const events: ExternalEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: "250",
      timeMin: new Date(window.from).toISOString(),
      timeMax: new Date(to).toISOString(),
      ...(pageToken && { pageToken }),
    });
    const res = await ctx.api(`${EVENTS_API}?${query}`);
    await ensureOk(res);
    const body: unknown = await res.json();
    const items = field(body, "items");
    if (Array.isArray(items))
      for (const item of items) {
        const event = toExternal(item, window.timeZone);
        if (event) events.push(event);
      }
    pageToken = text(body, "nextPageToken");
    if (!pageToken) break;
  }
  return events;
}

/**
 * "Vincular": a tarefa passa a ser deste evento que já existia, sem criar outro. O evento ganha o
 * `mewkiTaskId` (some da leitura como duplicata) e fica como está: só a próxima edição da tarefa o
 * sobrescreve, pela propagação (F4) — vincular não pode mudar a agenda de ninguém sem uma edição.
 */
export async function linkEvent(
  ctx: Ctx,
  input: { taskId: string; eventId: string; timeZone: string },
): Promise<{ link: IntegrationLink; task: Task }> {
  const task = await ownTask(ctx, input.taskId);
  const { DB } = ctx.env;
  const already = { code: INTEGRATION_ERROR.alreadyLinked };
  const existing = await getLink(DB, ctx.userId, "google-calendar", task.id);
  if (existing)
    throw new ActionError(409, "Esta tarefa já está na Agenda", {
      ...already,
      link: existing,
      task,
    });
  if (task.repeat !== "Off")
    throw new ActionError(400, "Tarefa recorrente não dá pra vincular a um evento");
  if (await getLinkByExternal(DB, ctx.userId, "google-calendar", input.eventId))
    throw new ActionError(409, "Este evento já está vinculado a outra tarefa", already);

  const url = `${EVENTS_API}/${encodeURIComponent(input.eventId)}`;
  const res = await ctx.api(url);
  if (res.status === 404 || res.status === 410)
    throw new ActionError(404, "Evento não encontrado na Agenda");
  await ensureOk(res);
  const event = toExternal(await res.json(), input.timeZone);
  if (!event) throw new ActionError(404, "Evento não encontrado na Agenda");
  if (event.mewkiTaskId)
    throw new ActionError(409, "Este evento já está vinculado a outra tarefa", already);
  if (event.recurring)
    throw new ActionError(400, "Evento recorrente não dá pra vincular a uma tarefa");

  // PATCH mescla os mapas de extendedProperties: o que outros apps guardaram ali fica.
  await ensureOk(
    await ctx.api(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ extendedProperties: { private: { mewkiTaskId: task.id } } }),
    }),
  );
  const link: IntegrationLink = {
    provider: "google-calendar",
    taskId: task.id,
    externalId: event.id,
    url: event.url,
  };
  await upsertLink(DB, ctx.userId, link, input.timeZone, Date.now());
  const added = [event.url, event.meet].filter((l): l is string => !!l);
  return { link, task: await addLinks(ctx, task, added) };
}

// PATCH mescla objetos: sem os nulls, trocar horário por dia inteiro deixaria date e dateTime juntos.
const CLEAR_WHEN = { date: null, dateTime: null, timeZone: null };

/** O que a Mewki escreve, com null no que saiu (local, recorrência). O Meet criado fica. */
const patchBody = (e: GoogleEvent) => ({
  summary: e.summary,
  description: e.description,
  location: e.location ?? null,
  start: { ...CLEAR_WHEN, ...e.start },
  end: { ...CLEAR_WHEN, ...e.end },
  recurrence: e.recurrence ?? null,
  extendedProperties: e.extendedProperties,
});

/** 404/410 = o evento já não existe (apagado no Google): o vínculo cai junto. */
async function syncEvent(
  ctx: Ctx,
  link: StoredLink,
  before: Task | null,
  after: Task | null,
): Promise<"unlink" | void> {
  const url = `${EVENTS_API}/${link.externalId}`;
  const tz = link.timeZone;
  if (!tz) throw new Error("vínculo sem fuso");
  // Sem dia (Sem data sem lembrete) o evento não tem onde ficar: sai, como a tarefa apagada.
  const next = after && toEvent(after, tz, { meet: false });
  let res: Response;
  if (!next) res = await ctx.api(url, { method: "DELETE" });
  else {
    const prev = before && toEvent(before, tz, { meet: false });
    if (prev && JSON.stringify(prev) === JSON.stringify(next)) return;
    res = await ctx.api(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patchBody(next)),
    });
  }
  if (res.status === 404 || res.status === 410) return "unlink";
  if (!res.ok) throw new Error(`Google Agenda ${res.status}: ${await res.text().catch(() => "")}`);
  if (!next) return "unlink";
}

export const googleCalendar: Provider = {
  id: "google-calendar",
  oauth: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    credentials: (env) => ({ id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET }),
    scopes: ["openid", "email", EVENTS],
    required: [EVENTS],
    // offline + consent: sem eles o Google não devolve refresh_token na reconexão.
    extraParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  // userinfo em vez de decodificar o id_token: mesmo caminho de qualquer provider (GitHub/Notion
  // não têm id_token) e nenhum JWT pra validar.
  async identify(ctx) {
    const res = await ctx.api("https://openidconnect.googleapis.com/v1/userinfo");
    if (!res.ok) throw new Error(`userinfo ${res.status}`);
    const body: unknown = await res.json();
    const sub = typeof body === "object" && body !== null ? Reflect.get(body, "sub") : undefined;
    const email = typeof body === "object" && body !== null ? Reflect.get(body, "email") : null;
    if (typeof sub !== "string") throw new Error("userinfo sem sub");
    return { accountId: sub, email: typeof email === "string" ? email : null };
  },
  actions: [createEvent],
  onTaskChanged: syncEvent,
};
