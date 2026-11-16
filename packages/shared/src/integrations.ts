import type { Role, Task } from "./types";
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

/**
 * O texto da confirmação ("Criar evento no Google Agenda · amanhã 15:00–15:30 · com Meet"). Mesmo
 * texto no cartão do web e no `preview` da action; `null` = a tarefa não tem dia.
 */
export function calendarEventPreview(
  task: Task,
  timeZone: string,
  opts: { meet: boolean; now: number },
): string | null {
  const slot = calendarSlot(task, timeZone);
  if (!slot) return null;
  const at = slot.allDay ? Date.UTC(slot.day.year, slot.day.month, slot.day.day, 12) : slot.start;
  const zone = slot.allDay ? "UTC" : timeZone;
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
  const clock = (ms: number) =>
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone }).format(ms);
  const when = slot.allDay
    ? `${day} · dia inteiro`
    : `${day} ${clock(slot.start)}–${clock(slot.end)}`;
  return [
    "Criar evento no Google Agenda",
    when,
    task.repeat !== "Off" && "recorrente",
    opts.meet && !videoLink(task.links) && "com Meet",
  ]
    .filter(Boolean)
    .join(" · ");
}
