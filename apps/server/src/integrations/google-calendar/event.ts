import {
  calendarSlot,
  isCalendarEventLink,
  isoDate,
  isoWallTime,
  meetLink,
  toRrule,
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
  conferenceData?: Conference;
}

const HANGOUTS_MEET = { type: "hangoutsMeet" } as const;

/** Sala nova (`createRequest`) ou uma que já existe, pelo código; as duas pedem conferenceDataVersion=1. */
export type Conference =
  | { createRequest: { requestId: string; conferenceSolutionKey: typeof HANGOUTS_MEET } }
  | {
      conferenceId: string;
      conferenceSolution: { key: typeof HANGOUTS_MEET };
      entryPoints: { entryPointType: "video"; uri: string }[];
    };

/** `requestId` novo = sala nova; repetir o mesmo devolve a sala daquele pedido. */
export const newMeet = (requestId: string): Conference => ({
  createRequest: { requestId, conferenceSolutionKey: HANGOUTS_MEET },
});

/** O Meet que a pessoa colou: o Google liga o evento a essa sala (e devolve ela no `hangoutLink`). */
function existingMeet(url: string): Conference {
  const code = new URL(url).pathname.slice(1);
  const uri = `https://meet.google.com/${code}`;
  return {
    conferenceId: code,
    conferenceSolution: { key: HANGOUTS_MEET },
    entryPoints: [{ entryPointType: "video", uri }],
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

/** Tarefa → evento; `null` quando ela não tem dia (Sem data sem lembrete). */
export function toEvent(task: Task, timeZone: string, opts: { meet: boolean }): GoogleEvent | null {
  const slot = calendarSlot(task, timeZone);
  if (!slot) return null;

  let start: When;
  let end: When;
  let startParts: ZonedParts;
  if (slot.allDay) {
    startParts = slot.day;
    const next = new Date(Date.UTC(slot.day.year, slot.day.month, slot.day.day + 1));
    start = { date: isoDate(slot.day) };
    end = { date: next.toISOString().slice(0, 10) };
  } else {
    startParts = zonedParts(slot.start, timeZone);
    start = { dateTime: isoWallTime(startParts), timeZone };
    end = { dateTime: isoWallTime(zonedParts(slot.end, timeZone)), timeZone };
  }

  const id = eventId(task.id);
  const links = (task.links ?? []).filter((url) => !isCalendarEventLink(url));
  const location = videoLink(links);
  const meet = meetLink(links);
  const recurrence = toRrule(task, startParts, timeZone);

  return {
    id,
    summary: task.title,
    description: ["Criado pela Mewki", ...links].join("\n"),
    ...(location && { location }),
    start,
    end,
    ...(recurrence && { recurrence }),
    extendedProperties: { private: { mewkiTaskId: task.id } },
    // Já tem Meet/Zoom: ele vira o local e não nasce uma segunda sala; o Meet também é a sala.
    ...(meet
      ? { conferenceData: existingMeet(meet) }
      : opts.meet && !location && { conferenceData: newMeet(id) }),
  };
}
