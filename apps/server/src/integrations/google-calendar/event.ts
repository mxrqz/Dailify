import {
  calendarSlot,
  dayMap,
  isCalendarEventLink,
  videoLink,
  zonedParts,
  type Task,
  type ZonedParts,
} from "@dailify/shared";

type When = { dateTime: string; timeZone: string } | { date: string };

/** O corpo do `events.insert`, só com o que a Mewki escreve. */
export interface GoogleEvent {
  id: string;
  summary: string;
  description: string;
  location?: string;
  start: When;
  end: When;
  recurrence?: string[];
  extendedProperties: { private: { mewkiTaskId: string } };
  conferenceData?: {
    createRequest: { requestId: string; conferenceSolutionKey: { type: "hangoutsMeet" } };
  };
}

const BASE32HEX = "0123456789abcdefghijklmnopqrstuv";

/**
 * Id do evento derivado do id da tarefa: retry cai no mesmo evento (409) em vez de duplicar. O
 * Google aceita só a–v e 0–9, de 5 a 1024 caracteres — base32hex minúsculo sem padding; o id da
 * tarefa (6..64 bytes) dá 10..103.
 */
export function eventId(taskId: string): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of new TextEncoder().encode(taskId)) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += BASE32HEX[(value >>> bits) & 31];
    }
    value &= (1 << bits) - 1;
  }
  return bits ? out + BASE32HEX[(value << (5 - bits)) & 31] : out;
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (p: ZonedParts) => `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
const wall = (p: ZonedParts) => `${ymd(p)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
const compact = (s: string) => s.replace(/[-:]/g, "");
const weekday = (p: ZonedParts) => new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay();
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** A mesma série do `expandRecurringTask`, em RRULE. */
function rrule(task: Task, start: ZonedParts): string | null {
  const { repeat } = task;
  if (repeat === "Off") return null;
  const every = task.repeatEvery && task.repeatEvery > 1 ? task.repeatEvery : 1;
  const rule = [`FREQ=${typeof repeat === "object" ? "WEEKLY" : repeat.toUpperCase()}`];
  if (every > 1) rule.push(`INTERVAL=${every}`);
  if (typeof repeat === "object") {
    const days = repeat.Weekly.map((d) => dayMap[d]).sort((a, b) => a - b);
    rule.push(`BYDAY=${days.map((d) => BYDAY[d]).join(",")}`);
    // A cada N semanas, a Mewki conta blocos de 7 dias a partir do dia da tarefa; com a semana do
    // RRULE começando nesse dia (WKST), os blocos batem.
    if (every > 1) rule.push(`WKST=${BYDAY[weekday(start)]}`);
  }
  // Dia 29–31: a Mewki corta pro último dia do mês curto, o RRULE puro pularia o mês.
  if ((repeat === "Monthly" || repeat === "Yearly") && start.day > 28) {
    if (repeat === "Yearly") rule.push(`BYMONTH=${start.month + 1}`);
    const days = Array.from({ length: start.day - 27 }, (_, i) => 28 + i);
    rule.push(`BYMONTHDAY=${days.join(",")}`, "BYSETPOS=-1");
  }
  return `RRULE:${rule.join(";")}`;
}

/** Tarefa → evento; `null` quando ela não tem dia (Sem data sem lembrete). */
export function toEvent(task: Task, timeZone: string, opts: { meet: boolean }): GoogleEvent | null {
  const slot = calendarSlot(task, timeZone);
  if (!slot) return null;

  let start: When;
  let end: When;
  let startParts: ZonedParts;
  let exdate: (ms: number) => string;
  if (slot.allDay) {
    startParts = slot.day;
    const next = new Date(Date.UTC(slot.day.year, slot.day.month, slot.day.day + 1));
    start = { date: ymd(slot.day) };
    end = { date: next.toISOString().slice(0, 10) };
    exdate = (ms) => compact(ymd(zonedParts(ms, timeZone)));
  } else {
    startParts = zonedParts(slot.start, timeZone);
    start = { dateTime: wall(startParts), timeZone };
    end = { dateTime: wall(zonedParts(slot.end, timeZone)), timeZone };
    exdate = (ms) => compact(wall(zonedParts(ms, timeZone)));
  }

  const id = eventId(task.id);
  const links = (task.links ?? []).filter((url) => !isCalendarEventLink(url));
  const location = videoLink(links);
  const rule = rrule(task, startParts);
  const exdates = rule && task.exdates?.length ? task.exdates.map(exdate).join(",") : null;
  const exdateLine = slot.allDay
    ? `EXDATE;VALUE=DATE:${exdates}`
    : `EXDATE;TZID=${timeZone}:${exdates}`;

  return {
    id,
    summary: task.title,
    description: ["Criado pela Mewki", ...links].join("\n"),
    ...(location && { location }),
    start,
    end,
    ...(rule && { recurrence: exdates ? [rule, exdateLine] : [rule] }),
    extendedProperties: { private: { mewkiTaskId: task.id } },
    // Já tem Meet/Zoom: ele vira o local e não nasce uma segunda sala.
    ...(opts.meet &&
      !location && {
        conferenceData: {
          createRequest: { requestId: id, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
  };
}
