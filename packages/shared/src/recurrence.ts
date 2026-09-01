import type { Task, Repeat } from "./types";
import { daysInMonth, zonedEpoch, zonedParts, type ZonedParts } from "./timezone";

/** Sem fuso explícito vale o do runtime — que no browser é exatamente o do usuário. */
function localParts(epochMs: number, timeZone?: string): ZonedParts {
  if (timeZone) return zonedParts(epochMs, timeZone);
  const d = new Date(epochMs);
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
    ms: d.getMilliseconds(),
  };
}

function localEpoch(parts: ZonedParts, timeZone?: string): number {
  if (timeZone) return zonedEpoch(parts, timeZone);
  return new Date(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.ms ?? 0,
  ).getTime();
}

function weekdayIndex(epochMs: number, timeZone?: string): number {
  if (!timeZone) return new Date(epochMs).getDay();
  // O dia da semana tem que ser o do fuso do usuário: 22:00 de domingo em São Paulo já é segunda em UTC.
  const p = zonedParts(epochMs, timeZone);
  return new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay();
}

export const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const dayMap: Record<string, number> = Object.fromEntries(weekDays.map((d, i) => [d, i]));

function hasWeekly(value: object): value is { Weekly: unknown } {
  return "Weekly" in value;
}

/** Coerces an unknown repeat value (e.g. from the voice API) into a valid Task["repeat"]. */
export function normalizeRepeat(value: unknown): Repeat {
  if (value === "Off" || value === "Daily" || value === "Monthly" || value === "Yearly") {
    return value;
  }
  if (value && typeof value === "object" && hasWeekly(value)) {
    const weekly = value.Weekly;
    if (Array.isArray(weekly)) return { Weekly: weekly };
  }
  return "Off";
}

/**
 * Expands one recurring task into the concrete instances that fall in `month`.
 * Instances are built in the *viewed* month (not the original one) and carry epoch-ms dates.
 * The original day in its creation month is left to the stored task doc, so it is not
 * duplicated here (creation month is skipped for Monthly/Yearly and the original day is
 * skipped for Daily/Weekly).
 *
 * `timeZone` decide em que fuso a hora-de-parede é reconstruída. Sem ele vale o fuso do runtime —
 * certo no browser (é o do usuário), errado no Worker (é sempre UTC), então o servidor SEMPRE passa
 * o fuso do cliente. Sem isso a mesma série rendia horas diferentes nos dois lados.
 */
export function expandRecurringTask(task: Task, month: Date, timeZone?: string): Task[] {
  const detached = new Set(task.exdates ?? []);
  return expandAll(task, month, timeZone).filter((instance) => !detached.has(instance.date));
}

function expandAll(task: Task, month: Date, timeZone?: string): Task[] {
  const original = localParts(task.date, timeZone);
  const year = month.getFullYear();
  const mon = month.getMonth();
  const days = daysInMonth(year, mon);
  const monthEnd = localEpoch(
    { year, month: mon, day: days, hour: 23, minute: 59, second: 59, ms: 999 },
    timeZone,
  );

  // Nothing recurs before the task existed.
  if (monthEnd < task.date) return [];

  const inCreationMonth = original.year === year && original.month === mon;
  const at = (day: number): number =>
    localEpoch(
      {
        year,
        month: mon,
        day,
        hour: original.hour,
        minute: original.minute,
        second: original.second,
      },
      timeZone,
    );
  const instance = (date: number): Task => ({ ...task, date });

  const repeat = task.repeat;

  if (typeof repeat === "string") {
    switch (repeat) {
      case "Daily": {
        const out: Task[] = [];
        for (let d = inCreationMonth ? original.day + 1 : 1; d <= days; d++) {
          out.push(instance(at(d)));
        }
        return out;
      }
      case "Monthly": {
        if (inCreationMonth) return [];
        return [instance(at(Math.min(original.day, days)))];
      }
      case "Yearly": {
        if (original.month !== mon || original.year === year) return [];
        return [instance(at(Math.min(original.day, days)))];
      }
      default:
        return []; // "Off"
    }
  }

  // Weekly — repeat.Weekly is a list of weekday names ("Monday", …), matched via weekDays index.
  const repeatDays = repeat?.Weekly;
  if (!Array.isArray(repeatDays) || repeatDays.length === 0) return [];

  const out: Task[] = [];
  for (let d = 1; d <= days; d++) {
    if (inCreationMonth && d === original.day) continue; // stored doc covers this day
    const ts = at(d);
    if (repeatDays.includes(weekDays[weekdayIndex(ts, timeZone)])) out.push(instance(ts));
  }
  return out;
}
