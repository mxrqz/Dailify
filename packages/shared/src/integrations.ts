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

/** O `htmlLink` de um evento do Google Agenda — é ele, nos links da tarefa, que marca "já está lá". */
export function isCalendarEventLink(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { hostname, pathname } = new URL(url);
  return hostname === "www.google.com" && pathname === "/calendar/event";
}

/** Um evento do Google Agenda lido sob demanda (`GET …/events`): só pra mostrar, nunca guardado. */
export interface ExternalEvent {
  id: string;
  /** "" quando o evento não tem título: o web troca pelo seu texto. */
  title: string;
  start: number;
  /** Exclusivo; no dia inteiro é a meia-noite do dia seguinte, no fuso pedido. */
  end: number;
  allDay: boolean;
  url: string;
  meet?: string;
  /** Criado (ou vinculado) pela Mewki: a tarefa já aparece, o evento não precisa. */
  mewkiTaskId?: string;
  /** Ocorrência de uma série do Google: vincular só uma ocorrência a uma tarefa não faz sentido. */
  recurring?: boolean;
}

const MATCH_WINDOW = 15 * 60_000;

const normTitle = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const normUrl = (url: string) => {
  if (!URL.canParse(url)) return url;
  const { hostname, pathname } = new URL(url);
  return `${hostname}${pathname.replace(/\/$/, "")}`.toLowerCase();
};

/**
 * O evento do Google que parece ser esta tarefa (o "Vincular" do dedupe): o mesmo Meet, ou o mesmo
 * título (sem acento/caixa) começando até 15 min de distância. `events` = os da janela que o
 * chamador mostra (o dia). Tarefa já vinculada, recorrente ou Sem data não entra; evento da Mewki
 * ou ocorrência de série também não.
 */
export function matchExternalEvent(task: Task, events: ExternalEvent[]): ExternalEvent | undefined {
  if (task.undated || task.repeat !== "Off" || task.links?.some(isCalendarEventLink)) return;
  const meet = videoLink(task.links);
  const title = normTitle(task.title);
  return events.find(
    (e) =>
      !e.mewkiTaskId &&
      !e.recurring &&
      ((meet !== undefined && e.meet !== undefined && normUrl(meet) === normUrl(e.meet)) ||
        (!e.allDay &&
          title !== "" &&
          normTitle(e.title) === title &&
          Math.abs(e.start - task.date) <= MATCH_WINDOW)),
  );
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
