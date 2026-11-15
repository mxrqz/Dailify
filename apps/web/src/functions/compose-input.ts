import { weekDays, type ParsedTaskWire, type Repeat, type TaskInput } from "@dailify/shared";

import type { ParsedTask } from "./parse-task";
import { zoned, zonedAt } from "./zone";

export const DEFAULT_HOUR = 9; // dia sem hora ("amanhã" puro) cai no começo do dia útil, não em 00:00
export const DEFAULT_DURATION = "10m";

/**
 * Onde a tarefa vai parar: só o que tem horário entra na agenda. Sem horário vai para Sem data —
 * com lembrete às 09:00 se citou um dia, sem lembrete se não citou. `undatedOnly` (campo do bloco
 * "A qualquer hora") ignora a hora do parser.
 */
export function composeTaskInput(
  parsed: ParsedTask,
  now: Date,
  opts: { undatedOnly?: boolean } = {},
): TaskInput {
  const base = {
    title: parsed.text,
    duration: parsed.duration ?? DEFAULT_DURATION,
    priority: 0,
    repeat: parsed.repeat,
    // Um link por tarefa: a frase pode trazer vários, fica o primeiro.
    links: parsed.links.length ? parsed.links.slice(0, 1) : undefined,
  };

  if (parsed.date && parsed.hasTime && !opts.undatedOnly) {
    return { ...base, date: parsed.date.getTime() };
  }

  const date = parsed.date && parsed.hasDay && undatedReminder(parsed.date, parsed.repeat, now);
  if (date) return { ...base, date: date.getTime(), alert: date.getTime(), undated: true };

  return { ...base, date: now.getTime(), undated: true };
}

/** Lembrete de Sem data: o dia às 09:00, ou `null` se já passou e não há próxima ocorrência. */
export function undatedReminder(day: Date, repeat: Repeat, now: Date): Date | null {
  // Cópia: quem chama pode estar usando o mesmo objeto (o composer, pros chips).
  const at = zoned(day);
  at.setHours(DEFAULT_HOUR, 0, 0, 0);
  // Lembrete no passado dispararia push logo após criar (o cron tem tolerância de 1h).
  return at > now ? at : nextReminder(at, repeat, now);
}

/** Próxima ocorrência futura da série às 09:00; `null` para avulsa (fica sem lembrete). */
function nextReminder(day: Date, repeat: Repeat, now: Date): Date | null {
  if (repeat === "Off") return null;
  const at = (days: number, months = 0, years = 0) =>
    zonedAt(day.getFullYear() + years, day.getMonth() + months, day.getDate() + days, DEFAULT_HOUR);

  if (typeof repeat === "object") {
    for (let i = 1; i <= 7; i++) {
      const candidate = at(i);
      if (repeat.Weekly.includes(weekDays[candidate.getDay()]) && candidate > now) return candidate;
    }
    return null;
  }
  if (repeat === "Monthly") return at(0, 1);
  return repeat === "Yearly" ? at(0, 0, 1) : at(1);
}

/** Dia escolhido no calendário entra quando a frase não cita um; a hora da frase é mantida. */
export function onDay(parsed: ParsedTask, day: Date | null | undefined): ParsedTask {
  if (!day || parsed.hasDay) return parsed;
  const date = zoned(day);
  const time = parsed.hasTime ? parsed.date : null;
  date.setHours(time?.getHours() ?? 0, time?.getMinutes() ?? 0, 0, 0);
  return { ...parsed, date, hasDay: true };
}

/** Rascunho da Mew (`POST /tasks/parse`) no formato do parser local, pros chips e o `composeTaskInput`. */
export const fromWire = (wire: ParsedTaskWire): ParsedTask => ({
  ...wire,
  date: wire.date === null ? null : zoned(wire.date),
  unsure: [],
  fields: { day: [], time: [], duration: [], repeat: [], links: [] },
});

/** O que foi mexido nos chips do composer. `null` = tirado (sem dia, sem hora, "Off", sem link). */
export type Edits = Partial<{
  day: Date | null;
  time: { hour: number; minute: number } | null;
  duration: string | null;
  repeat: Repeat | null;
  links: string[] | null;
}>;

/**
 * O editado vale sobre o lido, e as palavras continuam fora do título. Sem dia, a hora cai na
 * próxima vez que ela acontece (hoje ou amanhã), como no parser.
 */
export function withEdits(parsed: ParsedTask, edits: Edits, now: Date): ParsedTask {
  let { date, hasDay, hasTime } = parsed;
  const clock = (base: Date, hour: number, minute: number) => {
    const at = zoned(base);
    at.setHours(hour, minute, 0, 0);
    if (!hasDay && at < now) at.setDate(at.getDate() + 1);
    return at;
  };

  if (edits.day !== undefined) {
    hasDay = edits.day !== null;
    const time = hasTime && date ? date : null;
    date = edits.day
      ? clock(edits.day, time?.getHours() ?? 0, time?.getMinutes() ?? 0)
      : time && clock(now, time.getHours(), time.getMinutes());
  }
  if (edits.time !== undefined) {
    hasTime = edits.time !== null;
    const base = hasDay && date ? date : now;
    date = edits.time
      ? clock(base, edits.time.hour, edits.time.minute)
      : hasDay
        ? clock(base, 0, 0)
        : null;
  }

  return {
    ...parsed,
    date,
    hasDay,
    hasTime,
    duration: edits.duration !== undefined ? edits.duration : parsed.duration,
    repeat: edits.repeat !== undefined ? (edits.repeat ?? "Off") : parsed.repeat,
    links: edits.links !== undefined ? (edits.links ?? []) : parsed.links,
  };
}
