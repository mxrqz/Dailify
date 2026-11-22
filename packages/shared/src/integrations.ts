import type { Role, Task } from "./types";
import { fillShared, sharedCopy } from "./copy";
import { durationMinutes } from "./duration";
import { API_ERROR } from "./errors";
import { videoLink, isCalendarEventLink } from "./parse-links";
import { dayMap, seriesEvery, seriesOf } from "./recurrence";
import { civilDay, zonedParts, type ZonedParts } from "./timezone";

export type ProviderId = "google-calendar" | "slack";

/** An integration the AI may put a task in; `meet` asks for a Meet room. */
export type CalendarTarget = { provider: ProviderId; meet?: boolean };

/**
 * Catálogo das integrações e quem pode usar cada uma. O gate é por plano, não por quota.
 * `tasks` = takes tasks: an AI `targets` destination (a calendar), not just a Mew app.
 */
export const INTEGRATIONS: Record<ProviderId, { name: string; roles: Role[]; tasks: boolean }> = {
  "google-calendar": {
    name: sharedCopy.providers["google-calendar"],
    roles: ["free", "pro", "max"],
    tasks: true,
  },
  slack: { name: sharedCopy.providers.slack, roles: ["pro", "max"], tasks: false },
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(INTEGRATIONS, value);
}

export const PROVIDER_IDS: readonly ProviderId[] = Object.keys(INTEGRATIONS).filter(isProviderId);

// admin passa em tudo, como o -1 dele nas quotas.
export const canUseIntegration = (role: Role, id: ProviderId): boolean =>
  role === "admin" || INTEGRATIONS[id].roles.includes(role);

/** Legacy 400 text for an unticked scope, kept for app builds that compare it. */
export const MISSING_SCOPE_ERROR = "Faltou permissão: marque o acesso à agenda na tela do Google";

export interface IntegrationStatus {
  provider: ProviderId;
  allowed: boolean;
  /** O servidor tem as credenciais do provider; sem elas a linha é "Em breve". */
  configured: boolean;
  connected: boolean;
  status?: "active" | "revoked";
  account?: string;
  /** Tarefas cuja última propagação falhou: o web mostra "não sincronizado" e oferece reenviar. */
  stale?: string[];
  /** Importadas que parecem uma tarefa própria: o web oferece juntar ou manter as duas. */
  duplicates?: { taskId: string; importedId: string }[];
  /** Tarefas de convite que só o organizador muda: título, data e recorrência travados na UI. */
  readonly?: string[];
  /** The Mew reads from this app without asking ("Sempre permitir"). */
  readAlways?: boolean;
  /** Eventos que a Mewki não sabe representar (recorrência exótica, dia inteiro repetido). */
  skipped?: number;
  /** Google connected without the Tasks scope (older connections): reconnecting imports them. */
  tasksMissing?: true;
}

/** Tarefa <-> objeto externo (`integration_links`). */
export interface IntegrationLink {
  provider: ProviderId;
  taskId: string;
  externalId: string;
  url: string | null;
}

/** The integration slice of `API_ERROR`: the 409 codes of the actions. */
export const INTEGRATION_ERROR = {
  reconnect: API_ERROR.reconnect,
  alreadyLinked: API_ERROR.alreadyLinked,
} as const;

/**
 * Onde a tarefa cai na agenda: com horário = início e fim; Sem data com lembrete = dia inteiro, no
 * dia do lembrete (o 09:00 é só a hora do push); Sem data sem lembrete não tem dia = `null`.
 * Midnight to midnight in `timeZone` (an imported multi-day event) is `days` whole days.
 */
export type CalendarSlot =
  { allDay: false; start: number; end: number } | { allDay: true; day: ZonedParts; days: number };

const isMidnight = (p: ZonedParts) => p.hour === 0 && p.minute === 0 && p.second === 0;

export function calendarSlot(task: Task, timeZone: string): CalendarSlot | null {
  if (task.undated)
    return task.alert === undefined
      ? null
      : { allDay: true, day: zonedParts(task.alert, timeZone), days: 1 };
  const end = task.date + durationMinutes(task.duration) * 60_000;
  const [from, to] = [zonedParts(task.date, timeZone), zonedParts(end, timeZone)];
  const days = civilDay(to) - civilDay(from);
  if (days > 0 && isMidnight(from) && isMidnight(to)) return { allDay: true, day: from, days };
  return { allDay: false, start: task.date, end };
}

const MATCH_WINDOW = 15;

const normTitle = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const normUrl = (url: string) => {
  if (!URL.canParse(url)) return url;
  const { hostname, pathname } = new URL(url);
  return `${hostname}${pathname.replace(/\/$/, "")}`.toLowerCase();
};
const sameRule = (a: Task, b: Task) =>
  (a.repeatEvery ?? 1) === (b.repeatEvery ?? 1) &&
  (typeof a.repeat === "object" && typeof b.repeat === "object"
    ? [...a.repeat.Weekly].sort().join() === [...b.repeat.Weekly].sort().join()
    : a.repeat === b.repeat);

/**
 * A tarefa própria que parece ser esta importada da Agenda (o par que o web oferece juntar): o
 * mesmo Meet, ou o mesmo título (sem acento/caixa) começando até 15 min de distância. Série casa
 * com série da mesma regra pela hora de parede no fuso (a 1ª ocorrência de cada uma pode ser outro
 * dia). Tarefa já vinculada (com o link de um evento) ou Sem data só casa pelo Meet.
 */
export function matchDuplicate(imported: Task, own: Task[], timeZone: string): Task | undefined {
  const meet = videoLink(imported.links);
  const title = normTitle(imported.title);
  const minutes = (ms: number) => {
    const p = zonedParts(ms, timeZone);
    return p.hour * 60 + p.minute;
  };
  const near = (t: Task) => {
    if (imported.repeat === "Off") return Math.abs(t.date - imported.date) <= MATCH_WINDOW * 60_000;
    const diff = Math.abs(minutes(t.date) - minutes(imported.date));
    return sameRule(t, imported) && Math.min(diff, 1440 - diff) <= MATCH_WINDOW;
  };
  return own.find((t) => {
    if (t.id === imported.id || t.links?.some(isCalendarEventLink)) return false;
    const theirs = videoLink(t.links);
    if (meet && theirs && normUrl(meet) === normUrl(theirs)) return true;
    return (
      title !== "" &&
      !t.undated &&
      !imported.undated &&
      (t.repeat === "Off") === (imported.repeat === "Off") &&
      normTitle(t.title) === title &&
      near(t)
    );
  });
}

const list = (items: string[]) =>
  items.length > 1
    ? fillShared(sharedCopy.listAnd, {
        rest: items.slice(0, -1).join(", "),
        last: items[items.length - 1],
      })
    : items[0];

/** "toda segunda e quarta", "a cada 3 dias", "todo dia 16": a regra da série, como no RRULE. */
function repeatText(task: Task, start: ZonedParts): string {
  const { repeat } = task;
  const t = sharedCopy.repeat;
  const n = seriesEvery(task);
  const pad = (v: number) => String(v).padStart(2, "0");
  const date = fillShared(sharedCopy.dayMonth, { dd: pad(start.day), mm: pad(start.month + 1) });
  if (typeof repeat === "object") {
    const days = repeat.Weekly.map((d) => dayMap[d]).sort((a, b) => a - b);
    const names = list(days.map((d) => sharedCopy.weekdays[d]));
    if (n > 1) return fillShared(t.weeklyEvery, { n, days: names });
    return fillShared(days[0] === 0 || days[0] === 6 ? t.weeklyWeekend : t.weekly, { days: names });
  }
  if (repeat === "Daily") return n > 1 ? fillShared(t.dailyEvery, { n }) : t.daily;
  if (repeat === "Monthly")
    return fillShared(n > 1 ? t.monthlyEvery : t.monthly, { n, day: start.day });
  return fillShared(n > 1 ? t.yearlyEvery : t.yearly, { n, date });
}

/**
 * O texto da confirmação ("Criar evento na Agenda · amanhã 15:00–15:30 · com Meet"). Mesmo
 * texto no cartão do web e no `preview` da action; `null` = a tarefa não tem dia. Série mostra a
 * regra e o início dela, que é onde o evento começa — não o dia da instância tocada.
 */
export function calendarEventPreview(
  instance: Task,
  timeZone: string,
  opts: { meet: boolean; now: number },
): string | null {
  const task = seriesOf(instance);
  const slot = calendarSlot(task, timeZone);
  if (!slot) return null;
  const at = slot.allDay ? Date.UTC(slot.day.year, slot.day.month, slot.day.day, 12) : slot.start;
  const zone = slot.allDay ? "UTC" : timeZone;
  const t = sharedCopy.calendarPreview;
  const { locale } = sharedCopy;
  const clock = (ms: number) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(ms);
  const time = slot.allDay ? t.allDay : `${clock(slot.start)}–${clock(slot.end)}`;

  let when: string;
  if (task.repeat !== "Off") {
    const start = zonedParts(at, zone);
    const sameYear = start.year === zonedParts(opts.now, timeZone).year;
    const since = new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      ...(!sameYear && { year: "numeric" }),
      timeZone: zone,
    }).format(at);
    const rule = repeatText(task, start);
    when = fillShared(t.series, { rule, sep: slot.allDay ? "," : "", time, since });
  } else {
    const diff = civilDay(zonedParts(at, zone)) - civilDay(zonedParts(opts.now, timeZone));
    const day =
      diff === 0
        ? t.today
        : diff === 1
          ? t.tomorrow
          : new Intl.DateTimeFormat(locale, {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: zone,
            }).format(at);
    when = fillShared(slot.allDay ? t.allDayOn : t.timedOn, { day, time });
  }
  return [t.title, when, opts.meet && !videoLink(task.links) && t.withMeet]
    .filter(Boolean)
    .join(" · ");
}
