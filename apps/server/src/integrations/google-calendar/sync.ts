import {
  DEFAULT_DURATION,
  TASK_LIMITS,
  fromRrule,
  isRecord,
  isTimeZone,
  matchDuplicate,
  meetLink,
  minutesToDuration,
  zonedEpoch,
  zonedParts,
  type Recurrence,
  type Task,
} from "@dailify/shared";
import type { Env } from "../../index";
import {
  claimSync,
  dropTasks,
  importTask,
  instanceLinks,
  linkByExternal,
  linkStatement,
  oldestSyncs,
  saveSyncState,
  setRemoteState,
  unlinkedTasks,
  type SyncLink,
} from "../../db/calendar-sync";
import { deleteLink, getLink, setLinkState } from "../../db/integrations";
import { getSettings } from "../../db/settings";
import { getTask, setExdatesStatement, updateTask } from "../../db/tasks";
import { newTaskId } from "../../lib/task-input";
import { loadCtx } from "../connection";
import { appendLinks, withoutLink } from "../links";
import type { Ctx } from "../types";
import { EVENTS_API, field, text } from "./api";
import { eventId } from "./event";

const P = "google-calendar";
const THROTTLE = 60_000;
const DAY = 86_400_000;
const WINDOW = 30 * DAY;
// ponytail: 10 páginas × 250 = 2500 eventos; acima disso não vem nextSyncToken e cada passada
// refaz o full. Paginar entre passadas (guardar o pageToken) se alguém chegar perto.
const MAX_PAGES = 10;

interface When {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

/** O evento cru do `events.list`, só com o que o sync lê. */
interface Remote {
  id: string;
  status?: string;
  updated: number;
  summary?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: When;
  end?: When;
  originalStart?: When;
  recurringEventId?: string;
  recurrence?: string[];
  eventType: string;
  mewkiTaskId?: string;
  declined: boolean;
  /** Convite que só o organizador muda: a Mewki nunca manda PATCH. */
  readonly: boolean;
}

const when = (raw: unknown): When | undefined =>
  isRecord(raw)
    ? { date: text(raw, "date"), dateTime: text(raw, "dateTime"), timeZone: text(raw, "timeZone") }
    : undefined;

function read(raw: unknown): Remote | null {
  const id = text(raw, "id");
  if (!id) return null;
  const recurrence = field(raw, "recurrence");
  const attendees = field(raw, "attendees");
  const organizer = field(raw, "organizer");
  return {
    id,
    status: text(raw, "status"),
    updated: Date.parse(text(raw, "updated") ?? "") || 0,
    summary: text(raw, "summary"),
    htmlLink: text(raw, "htmlLink"),
    hangoutLink: text(raw, "hangoutLink"),
    start: when(field(raw, "start")),
    end: when(field(raw, "end")),
    originalStart: when(field(raw, "originalStartTime")),
    recurringEventId: text(raw, "recurringEventId"),
    recurrence: Array.isArray(recurrence)
      ? recurrence.filter((l): l is string => typeof l === "string")
      : undefined,
    eventType: text(raw, "eventType") ?? "default",
    mewkiTaskId: text(field(field(raw, "extendedProperties"), "private"), "mewkiTaskId"),
    declined:
      Array.isArray(attendees) &&
      attendees.some((a) => field(a, "self") === true && text(a, "responseStatus") === "declined"),
    readonly:
      organizer !== undefined &&
      field(organizer, "self") !== true &&
      field(raw, "guestsCanModify") !== true,
  };
}

/** O que vem do Google; prioridade, tags, alerta e conclusões são só da Mewki. */
interface Mapped {
  fields: Pick<
    Task,
    "title" | "date" | "duration" | "repeat" | "repeatEvery" | "repeatUntil" | "undated"
  >;
  exdates: number[];
  links: string[];
  end: number;
  /** Dia inteiro: o dia, pra montar o lembrete-âncora da tarefa Sem data. */
  day?: { year: number; month: number; day: number };
}

const ymd = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
};

/** `null` = não cabe no modelo (regra que a Mewki não expressa, dia inteiro recorrente ou multi-dia). */
function toFields(ev: Remote, timeZone: string): Mapped | null {
  if (!ev.start || !ev.end) return null;
  // The invite's sender writes the title: cap it like any task title before it reaches the AI.
  const title = (ev.summary?.trim() || "Sem título").slice(0, TASK_LIMITS.titleMax);
  const links = [ev.htmlLink, ev.hangoutLink].filter((l): l is string => !!l);
  const off: Recurrence = { repeat: "Off", repeatEvery: undefined, repeatUntil: undefined };

  if (ev.start.date) {
    if (ev.recurrence || !ev.end.date) return null;
    const day = ymd(ev.start.date);
    const end = ymd(ev.end.date);
    const span = Date.UTC(end.year, end.month, end.day) - Date.UTC(day.year, day.month, day.day);
    if (span > DAY) return null; // 0xp.11: multi-dia ainda não tem forma na Mewki
    const anchor = zonedEpoch({ ...day, hour: 9, minute: 0, second: 0 }, timeZone);
    return {
      fields: { title, date: anchor, duration: DEFAULT_DURATION, undated: true, ...off },
      exdates: [],
      links,
      end: zonedEpoch({ ...end, hour: 0, minute: 0, second: 0 }, timeZone),
      day,
    };
  }

  const start = Date.parse(ev.start.dateTime ?? "");
  const end = Date.parse(ev.end.dateTime ?? "");
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const series = ev.recurrence ? fromRrule(ev.recurrence, start, timeZone) : off;
  if (!series) return null;
  return {
    fields: {
      title,
      date: start,
      duration: minutesToDuration((end - start) / 60_000),
      undated: undefined,
      repeat: series.repeat,
      repeatEvery: series.repeatEvery,
      repeatUntil: series.repeatUntil,
    },
    exdates: series.exdates ?? [],
    links,
    end,
  };
}

function withLinks(current: string[] | undefined, added: string[]): string[] | undefined {
  const links = appendLinks(current, added);
  return links.length ? links : undefined;
}

/**
 * O lembrete acompanha o evento: no dia inteiro é a âncora (mesma hora de parede, 09:00 sem
 * lembrete); com horário, anda junto com o início.
 */
function alertFor(task: Task, mapped: Mapped, timeZone: string): number | undefined {
  if (mapped.day) {
    const wall =
      task.alert !== undefined ? zonedParts(task.alert, timeZone) : { hour: 9, minute: 0 };
    return zonedEpoch({ ...mapped.day, hour: wall.hour, minute: wall.minute, second: 0 }, timeZone);
  }
  return task.alert === undefined ? undefined : task.alert + (mapped.fields.date - task.date);
}

/** Uma passada: o que todas as etapas compartilham. */
interface Pass {
  db: D1Database;
  userId: string;
  zone: string;
  now: number;
  cutoff: number;
  imported: number;
  skipped: number;
  /** Candidatas a duplicata, lidas uma vez por passada e só se alguém for importado. */
  own?: Task[];
}

function zoneOf(s: Pass, ev: Remote): string {
  const zone = ev.start?.timeZone;
  return isTimeZone(zone) ? zone : s.zone;
}

async function addExdate(s: Pass, taskId: string, at: number): Promise<void> {
  const task = await getTask(s.db, s.userId, taskId);
  if (!task || task.exdates?.includes(at)) return;
  await setExdatesStatement(s.db, s.userId, taskId, [...(task.exdates ?? []), at]).run();
}

/** LWW: Google mais novo aplica; a Mewki mais nova ganha e o vínculo fica `stale` (o reenvio). */
async function update(s: Pass, ev: Remote, link: SyncLink): Promise<void> {
  if (link.remoteUpdated !== null && ev.updated <= link.remoteUpdated) return; // eco do próprio PATCH
  const task = await getTask(s.db, s.userId, link.taskId);
  if (!task) return dropTasks(s.db, s.userId, [link.taskId]);
  const tz = zoneOf(s, ev);
  const mapped = toFields(ev, tz);
  if (!mapped) return; // a regra deixou de caber: a tarefa fica como estava
  const state = {
    remoteUpdated: ev.updated,
    readonly: ev.readonly,
    silenceAlert: link.imported && !!mapped.day,
  };
  // Convite: a agenda é do organizador, não há o que reenviar — o Google sempre ganha.
  if (!ev.readonly && (task.updatedAt ?? 0) >= ev.updated) {
    await setLinkState(s.db, s.userId, P, link.taskId, { stale: true }, s.now);
    return setRemoteState(s.db, s.userId, link.taskId, { ...state, silenceAlert: false });
  }
  await updateTask(s.db, s.userId, task.id, {
    ...mapped.fields,
    duration: mapped.day ? task.duration : mapped.fields.duration,
    alert: alertFor(task, mapped, tz),
    // A sala é a do evento: Meet trocado ou tirado lá não deixa o antigo pra trás aqui.
    links: withLinks(
      task.links?.filter((l) => !meetLink([l])),
      mapped.links,
    ),
    updatedAt: Math.max(ev.updated, task.updatedAt ?? 0),
  });
  const exdates = [...new Set([...(task.exdates ?? []), ...mapped.exdates])];
  if (exdates.length !== (task.exdates?.length ?? 0))
    await setExdatesStatement(s.db, s.userId, task.id, exdates).run();
  await setRemoteState(s.db, s.userId, task.id, state);
}

/** Evento sem vínculo vira tarefa; `base` = a série, quando é uma ocorrência que virou solta. */
async function create(
  s: Pass,
  ev: Remote,
  opts: { imported: boolean; base?: Task },
): Promise<void> {
  const tz = zoneOf(s, ev);
  const mapped = toFields(ev, tz);
  if (!mapped) {
    s.skipped++;
    return;
  }
  const endsAt = mapped.fields.repeat === "Off" ? mapped.end : mapped.fields.repeatUntil;
  if (!opts.base && endsAt !== undefined && endsAt < s.cutoff) return; // passado: fica na Agenda
  const id = newTaskId();
  const task: Task = {
    priority: 0,
    ...opts.base,
    ...mapped.fields,
    id,
    // A ocorrência solta herda o lembrete da série, deslocado pro dia dela.
    alert: opts.base ? alertFor(opts.base, mapped, tz) : mapped.day && mapped.fields.date,
    links: withLinks(undefined, mapped.links),
    completed: [],
    exdates: mapped.exdates.length ? mapped.exdates : undefined,
    seriesStart: undefined,
    updatedAt: ev.updated || s.now,
  };
  let duplicateOf: string | undefined;
  if (!opts.base) {
    s.own ??= await unlinkedTasks(s.db, s.userId);
    duplicateOf = matchDuplicate(task, s.own, tz)?.id;
  }
  await importTask(
    s.db,
    s.userId,
    task,
    {
      taskId: id,
      externalId: ev.id,
      url: ev.htmlLink ?? "",
      timeZone: tz,
      imported: opts.imported,
      readonly: ev.readonly,
      remoteUpdated: ev.updated,
      duplicateOf,
    },
    s.now,
  );
  s.imported++;
}

/** Apagado no Google: a Mewki desvincula o que ela criou e apaga o que veio de lá. */
async function cancel(s: Pass, ev: Remote): Promise<void> {
  const link = await linkByExternal(s.db, s.userId, ev.id);
  if (ev.recurringEventId) {
    const master = await linkByExternal(s.db, s.userId, ev.recurringEventId);
    const at = Date.parse(ev.originalStart?.dateTime ?? "");
    if (master && !Number.isNaN(at)) await addExdate(s, master.taskId, at);
    if (link) await dropTasks(s.db, s.userId, [link.taskId]);
    return;
  }
  if (!link) return;
  const all = [link, ...(await instanceLinks(s.db, s.userId, ev.id))];
  if (link.externalId !== eventId(link.taskId))
    return dropTasks(
      s.db,
      s.userId,
      all.map((l) => l.taskId),
    );
  for (const l of all) {
    await deleteLink(s.db, s.userId, P, l.taskId);
    const task = await getTask(s.db, s.userId, l.taskId);
    // Sem o endereço o web para de ler a tarefa como "Na Agenda" (como no `pushLink`).
    const links = withoutLink(task?.links, l.url);
    if (task && links) await updateTask(s.db, s.userId, task.id, { links });
  }
}

async function apply(s: Pass, ev: Remote): Promise<void> {
  if (ev.status === "cancelled") return cancel(s, ev);
  if (ev.eventType !== "default" || ev.declined) return; // ausência, foco, Gmail, recusado
  const link = await linkByExternal(s.db, s.userId, ev.id);
  if (link) return update(s, ev, link);

  if (ev.recurringEventId) {
    // Ocorrência mexida no Google: vira tarefa solta e sai da série, como o "editar só esta".
    const master = await linkByExternal(s.db, s.userId, ev.recurringEventId);
    const base = master && (await getTask(s.db, s.userId, master.taskId));
    if (!master || !base) return;
    const at = Date.parse(ev.originalStart?.dateTime ?? "");
    if (!Number.isNaN(at)) await addExdate(s, master.taskId, at);
    return create(s, ev, { imported: master.imported, base: { ...base, repeat: "Off" } });
  }

  // O vínculo se perdeu (troca de conta, D1 restaurado) mas o evento sabe de que tarefa é.
  const owner = ev.mewkiTaskId && (await getTask(s.db, s.userId, ev.mewkiTaskId));
  if (owner && !(await getLink(s.db, s.userId, P, owner.id))) {
    const relinked: SyncLink = {
      taskId: owner.id,
      externalId: ev.id,
      url: ev.htmlLink ?? null,
      imported: false,
      remoteUpdated: null,
      readonly: ev.readonly,
    };
    await linkStatement(
      s.db,
      s.userId,
      { ...relinked, url: ev.htmlLink ?? "", timeZone: zoneOf(s, ev), remoteUpdated: 0 },
      s.now,
    ).run();
    return update(s, ev, relinked);
  }
  return create(s, ev, { imported: true });
}

class Gone extends Error {}

/** Todas as páginas; `syncToken` só vem na última, e `done` = não parou no teto de páginas. */
async function list(
  ctx: Ctx,
  query: Record<string, string>,
): Promise<{ items: unknown[]; syncToken?: string; done: boolean }> {
  const items: unknown[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      singleEvents: "false",
      showDeleted: "true",
      maxResults: "250",
      ...query,
      ...(pageToken && { pageToken }),
    });
    const res = await ctx.api(`${EVENTS_API}?${params}`);
    if (res.status === 410) throw new Gone();
    if (!res.ok)
      throw new Error(`Google Agenda ${res.status}: ${await res.text().catch(() => "")}`);
    const body: unknown = await res.json();
    const got = field(body, "items");
    if (Array.isArray(got)) items.push(...got);
    pageToken = text(body, "nextPageToken");
    if (!pageToken) return { items, syncToken: text(body, "nextSyncToken"), done: true };
  }
  return { items, done: false };
}

/**
 * Traz os eventos da agenda principal pra Mewki (import + sync incremental pelo syncToken).
 * `full` ignora o token e o throttle e relê desde 30 dias atrás. Nunca chama a propagação: o que
 * vem do Google não volta pra ele.
 */
export async function syncCalendar(
  env: Env,
  userId: string,
  opts: { full?: boolean } = {},
): Promise<{ imported: number }> {
  const now = Date.now();
  // ponytail: o full passa por cima do lock; correndo junto de outra passada, o UNIQUE do vínculo
  // derruba o import repetido (o batch falha inteiro) e a próxima passada acerta.
  const claim = await claimSync(env.DB, userId, now, opts.full ? 0 : THROTTLE);
  if (!claim) return { imported: 0 };
  const ctx = await loadCtx(env, userId, P);
  if (!ctx) return { imported: 0 };

  const cutoff = now - WINDOW;
  const token = opts.full ? null : claim.syncToken;
  let listed =
    token &&
    (await list(ctx, { syncToken: token }).catch((err: unknown) => {
      if (err instanceof Gone) return null; // token vencido: volta pro full
      throw err;
    }));
  const full = !listed;
  if (!listed) {
    listed = await list(ctx, { timeMin: new Date(cutoff).toISOString() });
    // Se o Google não der nextSyncToken pra uma lista com timeMin, relê sem ele: o corte de 30
    // dias passa a valer só no import (`create`).
    if (listed.done && !listed.syncToken) listed = await list(ctx, {});
  }

  const zone = (await getSettings(env.DB, userId)).timeZone ?? "UTC";
  const s: Pass = { db: env.DB, userId, zone, now, cutoff, imported: 0, skipped: 0 };
  const events = listed.items.map(read).filter((e): e is Remote => e !== null);
  // Séries antes das ocorrências: a exceção precisa do vínculo da mestra, que pode vir depois.
  events.sort((a, b) => Number(!!a.recurringEventId) - Number(!!b.recurringEventId));
  for (const ev of events) await apply(s, ev);

  // ponytail: o incremental soma em `skipped` a cada edição do mesmo evento pulado; o full recompõe.
  await saveSyncState(
    env.DB,
    userId,
    listed.syncToken ?? null,
    full ? { set: s.skipped } : { add: s.skipped },
  );
  return { imported: s.imported };
}

/** O `waitUntil` do `GET /tasks`: o throttle decide se roda, e falha só vai pro log. */
export async function syncIfDue(env: Env, userId: string): Promise<void> {
  try {
    await syncCalendar(env, userId);
  } catch (err) {
    console.error(`Falha no sync da Agenda de ${userId}`, err);
  }
}

/** O cron: as 25 conexões que esperam há mais tempo, uma de cada vez (teto de subrequests). */
export async function syncOldest(env: Env): Promise<void> {
  for (const userId of await oldestSyncs(env.DB, 25)) await syncIfDue(env, userId);
}
