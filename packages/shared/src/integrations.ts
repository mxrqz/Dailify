import type { Role, Task } from "./types";
import { dayMap } from "./recurrence";
import { zonedParts, type ZonedParts } from "./timezone";

export type ProviderId = "google-calendar";

/** Catálogo das integrações e quem pode usar cada uma. O gate é por plano, não por quota. */
export const INTEGRATIONS: Record<ProviderId, { name: string; roles: Role[] }> = {
  "google-calendar": { name: "Google Agenda", roles: ["free", "pro", "max"] },
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(INTEGRATIONS, value);
}

export const PROVIDER_IDS: readonly ProviderId[] = Object.keys(INTEGRATIONS).filter(isProviderId);

// admin passa em tudo, como o -1 dele nas quotas.
export const canUseIntegration = (role: Role, id: ProviderId): boolean =>
  role === "admin" || INTEGRATIONS[id].roles.includes(role);

/** O 400 do callback quando a pessoa desmarcou o escopo: o SPA compara pra trocar pelo recado certo. */
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
  /** Eventos que a Mewki não sabe representar (recorrência exótica, dia inteiro repetido). */
  skipped?: number;
}

/** Tarefa <-> objeto externo (`integration_links`). */
export interface IntegrationLink {
  provider: ProviderId;
  taskId: string;
  externalId: string;
  url: string | null;
}

/** `code` dos 409 das actions: o cliente troca o recado conforme ele. */
export const INTEGRATION_ERROR = {
  reconnect: "reconnect",
  alreadyLinked: "already_linked",
} as const;

/** "1h30m" → 90; vazio ou ilegível → 10, o `DEFAULT_DURATION`. */
export function durationMinutes(duration: string): number {
  const h = /(\d+)\s*h/.exec(duration);
  const m = /(\d+)\s*m/.exec(duration);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0) || 10;
}

/** 90 → "1h30m", 60 → "1h", 45 → "45m": o inverso de `durationMinutes` (fim − início do evento). */
export function minutesToDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h ? `${h}h` : ""}${m || !h ? `${m}m` : ""}`;
}

/**
 * Onde a tarefa cai na agenda: com horário = início e fim; Sem data com lembrete = dia inteiro, no
 * dia do lembrete (o 09:00 é só a hora do push); Sem data sem lembrete não tem dia = `null`.
 */
export type CalendarSlot =
  { allDay: false; start: number; end: number } | { allDay: true; day: ZonedParts };

export function calendarSlot(task: Task, timeZone: string): CalendarSlot | null {
  if (!task.undated)
    return {
      allDay: false,
      start: task.date,
      end: task.date + durationMinutes(task.duration) * 60_000,
    };
  return task.alert === undefined ? null : { allDay: true, day: zonedParts(task.alert, timeZone) };
}

const VIDEO_HOSTS = [/^meet\.google\.com$/, /(^|\.)zoom\.us$/];

/** O primeiro link de Meet/Zoom: vira o `location` e dispensa criar outro Meet. */
export function videoLink(links: string[] = []): string | undefined {
  return links.find(
    (url) => URL.canParse(url) && VIDEO_HOSTS.some((re) => re.test(new URL(url).hostname)),
  );
}

/**
 * O primeiro link de sala do Meet (`meet.google.com/abc-defg-hij`): é o que vira o `conferenceData`
 * do evento — o código da sala é o `conferenceId` que o Google aceita.
 */
export function meetLink(links: string[] = []): string | undefined {
  return links.find(
    (url) =>
      URL.canParse(url) &&
      new URL(url).hostname === "meet.google.com" &&
      /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(new URL(url).pathname),
  );
}

/** O `htmlLink` de um evento do Google Agenda — é ele, nos links da tarefa, que marca "já está lá". */
export function isCalendarEventLink(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { hostname, pathname } = new URL(url);
  return hostname === "www.google.com" && pathname === "/calendar/event";
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

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const list = (items: string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} e ${items.at(-1)}` : items[0];

/** "toda segunda e quarta", "a cada 3 dias", "todo dia 16": a regra da série, como no RRULE. */
function repeatText(task: Task, start: ZonedParts): string {
  const { repeat } = task;
  const every = task.repeatEvery && task.repeatEvery > 1 ? task.repeatEvery : 1;
  const ddmm = `${String(start.day).padStart(2, "0")}/${String(start.month + 1).padStart(2, "0")}`;
  if (typeof repeat === "object") {
    const days = repeat.Weekly.map((d) => dayMap[d]).sort((a, b) => a - b);
    const names = list(days.map((d) => WEEKDAYS[d]));
    if (every > 1) return `a cada ${every} semanas, ${names}`;
    return `${days[0] === 0 || days[0] === 6 ? "todo" : "toda"} ${names}`;
  }
  if (repeat === "Daily") return every > 1 ? `a cada ${every} dias` : "todo dia";
  if (repeat === "Monthly")
    return every > 1 ? `a cada ${every} meses, dia ${start.day}` : `todo dia ${start.day}`;
  return every > 1 ? `a cada ${every} anos em ${ddmm}` : `todo ano em ${ddmm}`;
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
  const task =
    instance.seriesStart === undefined ? instance : { ...instance, date: instance.seriesStart };
  const slot = calendarSlot(task, timeZone);
  if (!slot) return null;
  const at = slot.allDay ? Date.UTC(slot.day.year, slot.day.month, slot.day.day, 12) : slot.start;
  const zone = slot.allDay ? "UTC" : timeZone;
  const clock = (ms: number) =>
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone }).format(ms);
  const time = slot.allDay ? "dia inteiro" : `${clock(slot.start)}–${clock(slot.end)}`;

  let when: string;
  if (task.repeat !== "Off") {
    const start = zonedParts(at, zone);
    const sameYear = start.year === zonedParts(opts.now, timeZone).year;
    const since = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      ...(!sameYear && { year: "numeric" }),
      timeZone: zone,
    }).format(at);
    when = `${repeatText(task, start)}${slot.allDay ? "," : ""} ${time}, desde ${since}`;
  } else {
    const dayKey = (ms: number, tz: string) => {
      const p = zonedParts(ms, tz);
      return Date.UTC(p.year, p.month, p.day);
    };
    const diff = (dayKey(at, zone) - dayKey(opts.now, timeZone)) / 86_400_000;
    const day =
      diff === 0
        ? "hoje"
        : diff === 1
          ? "amanhã"
          : new Intl.DateTimeFormat("pt-BR", {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: zone,
            }).format(at);
    when = slot.allDay ? `${day} · dia inteiro` : `${day} ${time}`;
  }
  return ["Criar evento na Agenda", when, opts.meet && !videoLink(task.links) && "com Meet"]
    .filter(Boolean)
    .join(" · ");
}
