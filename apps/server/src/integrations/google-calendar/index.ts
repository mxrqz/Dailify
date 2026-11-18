import {
  INTEGRATION_ERROR,
  isTimeZone,
  isoDate,
  meetLink,
  zonedParts,
  type IntegrationLink,
  type Task,
} from "@dailify/shared";
import {
  getLink,
  listInstanceIds,
  listTaskLinks,
  setRemoteUpdated,
  upsertLink,
  type StoredLink,
} from "../../db/integrations";
import { getTask, updateTask } from "../../db/tasks";
import { appendLinks } from "../links";
import { ActionError, type Ctx, type Provider } from "../types";
import { EVENTS_API, field, json, text, updatedOf } from "./api";
import { eventId, newMeet, toEvent, type GoogleEvent } from "./event";
import { syncCalendar } from "./sync";

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

async function addLinks(ctx: Ctx, task: Task, added: string[]): Promise<Task> {
  const links = appendLinks(task.links, added);
  return (await updateTask(ctx.env.DB, ctx.userId, task.id, { links })) ?? task;
}

/** Sem `conferenceDataVersion=1` o Google ignora o `conferenceData` do corpo. */
const conferenceQuery = (body: object) =>
  "conferenceData" in body ? "?conferenceDataVersion=1" : "";

/** Insert; 409 = o id já existe (retry depois de o D1 falhar, ou evento apagado que volta). */
async function saveEvent(ctx: Ctx, event: GoogleEvent) {
  const query = conferenceQuery(event);
  let res = await ctx.api(`${EVENTS_API}${query}`, json("POST", event));
  // PATCH com status confirmado: recupera o que existe e revive o que foi pra lixeira.
  if (res.status === 409)
    res = await ctx.api(
      `${EVENTS_API}/${event.id}${query}`,
      json("PATCH", { ...event, status: "confirmed" }),
    );
  await ensureOk(res);
  const body: unknown = await res.json();
  const htmlLink = text(body, "htmlLink");
  if (!htmlLink) throw new ActionError(502, "A Agenda não respondeu; tente de novo");
  return { htmlLink, hangoutLink: text(body, "hangoutLink"), updated: updatedOf(body) };
}

export const createEvent = {
  /** The input comes from the client (or an AI draft) and only passes validated. */
  parse(raw: unknown): { input: CreateEventInput } | { error: string } {
    const taskId = field(raw, "taskId");
    const timeZone = field(raw, "timezone");
    const meet = field(raw, "meet");
    if (typeof taskId !== "string" || !taskId) return { error: "taskId é obrigatório" };
    if (!isTimeZone(timeZone)) return { error: "Fuso inválido" };
    if (meet !== undefined && typeof meet !== "boolean") return { error: "meet inválido" };
    return { input: { taskId, timeZone, meet: meet === true } };
  },
  async run(ctx: Ctx, input: CreateEventInput): Promise<{ link: IntegrationLink; task: Task }> {
    const task = await ownTask(ctx, input.taskId);
    const existing = await getLink(ctx.env.DB, ctx.userId, "google-calendar", task.id);
    if (existing)
      throw new ActionError(409, "Task already on the calendar", {
        code: INTEGRATION_ERROR.alreadyLinked,
        link: existing,
        task,
      });
    const event = toEvent(task, input.timeZone, { meet: input.meet });
    if (!event) throw new ActionError(400, NO_DAY);

    const saved = await saveEvent(ctx, event);
    const link: IntegrationLink = {
      provider: "google-calendar",
      taskId: task.id,
      externalId: event.id,
      url: saved.htmlLink,
    };
    await upsertLink(ctx.env.DB, ctx.userId, link, input.timeZone, Date.now(), {
      remoteUpdated: saved.updated,
    });
    const added = [saved.htmlLink, saved.hangoutLink].filter((l): l is string => !!l);
    return { link, task: await addLinks(ctx, task, added) };
  },
};

// PATCH mescla objetos: sem os nulls, trocar horário por dia inteiro deixaria date e dateTime juntos.
const CLEAR_WHEN = { date: null, dateTime: null, timeZone: null };

/** O que a Mewki escreve, com null no que saiu (local, recorrência, Meet). */
const patchBody = (e: GoogleEvent) => ({
  summary: e.summary,
  description: e.description,
  location: e.location ?? null,
  start: { ...CLEAR_WHEN, ...e.start },
  end: { ...CLEAR_WHEN, ...e.end },
  recurrence: e.recurrence ?? null,
  extendedProperties: e.extendedProperties,
  conferenceData: e.conferenceData ?? null,
});

/**
 * O id da instância da série no Google: `${master}_20261118T130000Z` (UTC) ou, no dia inteiro,
 * `${master}_20261118` (o dia no fuso). `occurrence` = o início original da ocorrência.
 */
function instanceId(masterId: string, series: Task, occurrence: number, timeZone: string) {
  if (series.undated) {
    return `${masterId}_${isoDate(zonedParts(occurrence, timeZone)).replaceAll("-", "")}`;
  }
  return `${masterId}_${new Date(occurrence).toISOString().slice(0, 19).replace(/[-:]/g, "")}Z`;
}

/**
 * "Editar só esta" numa série vinculada: a tarefa solta passa a ser a instância daquele dia no
 * Google (vínculo próprio). Sem isso o EXDATE da série apagaria a ocorrência da Agenda. Devolve o
 * vínculo novo pra propagação fazer o PATCH (override) da instância.
 */
export async function linkInstance(
  ctx: Pick<Ctx, "env" | "userId">,
  series: StoredLink,
  master: Task,
  task: Task,
  occurrence: number,
): Promise<StoredLink> {
  const tz = series.timeZone;
  if (!tz) throw new Error("vínculo sem fuso");
  const link: StoredLink = {
    provider: "google-calendar",
    taskId: task.id,
    externalId: instanceId(series.externalId, master, occurrence, tz),
    url: series.url,
    timeZone: tz,
    stale: false,
    readonly: series.readonly,
  };
  await upsertLink(ctx.env.DB, ctx.userId, link, tz, Date.now(), { readonly: link.readonly });
  return link;
}

/** As datas que viraram instância vinculada saem do EXDATE: o EXDATE apagaria o override. */
async function withoutLinkedInstances(ctx: Ctx, link: StoredLink, task: Task, tz: string) {
  if (task.repeat === "Off" || !task.exdates?.length) return task;
  const linked = new Set(
    await listInstanceIds(ctx.env.DB, ctx.userId, link.provider, link.externalId),
  );
  if (!linked.size) return task;
  const exdates = task.exdates.filter(
    (at) => !linked.has(instanceId(link.externalId, task, at, tz)),
  );
  return { ...task, exdates };
}

// Evento que a Mewki não criou é da pessoa: só a agenda dele (título, horário, regra) e a sala do
// Meet, que a pessoa troca pela Mewki, são nossas.
const FOREIGN_KEYS = new Set(["summary", "start", "end", "recurrence", "conferenceData"]);

/**
 * Só as chaves que mudaram entre o evento de antes e o de agora; `prev` null (retry) = tudo o que
 * pode ir. Evento criado pela Mewki (id derivado da tarefa) leva o corpo todo; vinculado ou
 * importado nunca recebe description/location/extendedProperties; instância nunca leva recurrence.
 * O retry nunca mexe na sala: sem o "antes" não dá pra saber se ela mudou, e regravá-la tiraria os
 * telefones de discagem (só o link de vídeo vai) e a sala de um evento com Zoom.
 */
function patchFor(link: StoredLink, prev: GoogleEvent | null, next: GoogleEvent) {
  const created = link.externalId === eventId(link.taskId);
  const instance = link.externalId.includes("_");
  const old = prev && patchBody(prev);
  return Object.fromEntries(
    Object.entries(patchBody(next)).filter(
      ([key, value]) =>
        (created || FOREIGN_KEYS.has(key)) &&
        !(instance && key === "recurrence") &&
        !(!old && key === "conferenceData") &&
        (!old || JSON.stringify(Reflect.get(old, key)) !== JSON.stringify(value)),
    ),
  );
}

const NO_MEET = { meet: false };

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
  const next = after && toEvent(await withoutLinkedInstances(ctx, link, after, tz), tz, NO_MEET);
  let res: Response;
  if (!next) res = await ctx.api(url, { method: "DELETE" });
  else {
    // Convite que só o organizador muda: a edição fica na Mewki.
    if (link.readonly) return;
    const prev =
      before && toEvent(await withoutLinkedInstances(ctx, link, before, tz), tz, NO_MEET);
    const body = patchFor(link, prev, next);
    if (!Object.keys(body).length) return;
    res = await ctx.api(url + conferenceQuery(body), json("PATCH", body));
  }
  if (res.status === 404 || res.status === 410) return "unlink";
  if (!res.ok) throw new Error(`Google Agenda ${res.status}: ${await res.text().catch(() => "")}`);
  if (!next) return "unlink";
  const updated = updatedOf(await res.json().catch(() => null));
  if (updated !== undefined)
    await setRemoteUpdated(ctx.env.DB, ctx.userId, link.provider, link.taskId, updated);
}

/**
 * "Gerar novo Meet" numa tarefa da Agenda: só o `conferenceData` vai (vale pra evento vinculado
 * também), e o Meet antigo sai dos links. Sem `hangoutLink` na resposta a sala ainda está sendo
 * criada: o sync traz o link quando o Google terminar.
 */
export async function replaceMeet(ctx: Ctx, taskId: string): Promise<{ task: Task }> {
  const task = await ownTask(ctx, taskId);
  const link = (await listTaskLinks(ctx.env.DB, ctx.userId, taskId)).find(
    (l) => l.provider === "google-calendar",
  );
  if (!link) throw new ActionError(404, "Tarefa não está na Agenda");
  if (link.readonly) throw new ActionError(400, "Só quem convidou pode mudar");
  const res = await ctx.api(
    `${EVENTS_API}/${link.externalId}?conferenceDataVersion=1`,
    json("PATCH", { conferenceData: newMeet(crypto.randomUUID()) }),
  );
  if (res.status === 404 || res.status === 410)
    throw new ActionError(404, "O evento não existe mais na Agenda");
  await ensureOk(res);
  const body: unknown = await res.json();
  const updated = updatedOf(body);
  if (updated !== undefined)
    await setRemoteUpdated(ctx.env.DB, ctx.userId, link.provider, taskId, updated);
  const hangoutLink = text(body, "hangoutLink");
  const kept = { ...task, links: task.links?.filter((l) => !meetLink([l])) };
  return { task: await addLinks(ctx, kept, hangoutLink ? [hangoutLink] : []) };
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
    const sub = text(body, "sub");
    if (sub === undefined) throw new Error("userinfo sem sub");
    return { accountId: sub, email: text(body, "email") ?? null };
  },
  onTaskChanged: syncEvent,
  sync: (env, userId) => syncCalendar(env, userId),
};
