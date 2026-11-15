import { zoned, zonedAt } from "../zone";
import { parseDay } from "./dates";
import { type Span, mergeSpans } from "./spans";
import { type Base, type Time, parseTime } from "./times";
import { normalize, startOfDay } from "./vocab";

export interface ParsedWhen {
  date: Date;
  hasDay: boolean;
  hasTime: boolean;
  spans: Span[];
  /** Os spans de cada metade, pros chips do composer: `spans` é a união deles. */
  day: Span[];
  time: Span[];
}

// Recorrência lê a hora literal: o "9h" de uma série é 9h, não as 21h que seriam a próxima "9" de hoje.
// `start` é o início de um intervalo, que o `parseDuration` já resolveu e tirou da vista daqui.
export function parseWhen(
  input: string,
  now: Date = zoned(),
  literalTime = false,
  start: Time | null = null,
): ParsedWhen | null {
  const text = normalize(input);
  if (!text.trim() && !start) return null;

  const day = parseDay(text, now);
  const today = startOfDay(now).getTime();
  const base: Base =
    literalTime || day?.weekday
      ? "other"
      : !day
        ? "none"
        : day.value.getTime() === today
          ? "today"
          : "other";

  const time = start ? { value: start, spans: [] } : parseTime(text, now, base, literalTime);
  if (!day && !time) return null;
  const baseDay = day?.value ?? startOfDay(now);
  const at = (days: number) =>
    zonedAt(
      baseDay.getFullYear(),
      baseDay.getMonth(),
      baseDay.getDate() + (time?.value.days ?? 0) + days,
      time?.value.hour ?? 0,
      time?.value.minute ?? 0,
    );
  let date = at(0);
  // Hora sem dia que já passou é a de amanhã; "domingo" num domingo que já passou da hora (ou sem
  // hora) é o da semana que vem. A recorrência acha a própria ocorrência em `nextOccurrence`.
  if (!literalTime && date < now) {
    if (!day) date = at(1);
    else if (day.weekday) date = at(7);
  }

  return {
    date,
    hasDay: day !== null,
    hasTime: time !== null,
    spans: mergeSpans([...(day?.spans ?? []), ...(time?.spans ?? [])]),
    day: day?.spans ?? [],
    time: time?.spans ?? [],
  };
}
