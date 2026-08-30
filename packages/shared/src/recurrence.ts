import type { Task, Repeat } from "./types";

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
 */
export function expandRecurringTask(task: Task, month: Date): Task[] {
  const detached = new Set(task.exdates ?? []);
  return expandAll(task, month).filter((instance) => !detached.has(instance.date));
}

function expandAll(task: Task, month: Date): Task[] {
  const original = new Date(task.date);
  const year = month.getFullYear();
  const mon = month.getMonth();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const monthEnd = new Date(year, mon + 1, 0, 23, 59, 59, 999);

  // Nothing recurs before the task existed.
  if (monthEnd.getTime() < original.getTime()) return [];

  const inCreationMonth = original.getFullYear() === year && original.getMonth() === mon;
  const at = (day: number): number =>
    new Date(
      year,
      mon,
      day,
      original.getHours(),
      original.getMinutes(),
      original.getSeconds(),
    ).getTime();
  const instance = (date: number): Task => ({ ...task, date });

  const repeat = task.repeat;

  if (typeof repeat === "string") {
    switch (repeat) {
      case "Daily": {
        const out: Task[] = [];
        for (let d = inCreationMonth ? original.getDate() + 1 : 1; d <= daysInMonth; d++) {
          out.push(instance(at(d)));
        }
        return out;
      }
      case "Monthly": {
        if (inCreationMonth) return [];
        return [instance(at(Math.min(original.getDate(), daysInMonth)))];
      }
      case "Yearly": {
        if (original.getMonth() !== mon || original.getFullYear() === year) return [];
        return [instance(at(Math.min(original.getDate(), daysInMonth)))];
      }
      default:
        return []; // "Off"
    }
  }

  // Weekly — repeat.Weekly is a list of weekday names ("Monday", …), matched via weekDays index.
  const repeatDays = repeat?.Weekly;
  if (!Array.isArray(repeatDays) || repeatDays.length === 0) return [];

  const out: Task[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (inCreationMonth && d === original.getDate()) continue; // stored doc covers this day
    const ts = at(d);
    if (repeatDays.includes(weekDays[new Date(ts).getDay()])) out.push(instance(ts));
  }
  return out;
}
