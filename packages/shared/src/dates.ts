import { daysInMonth, zonedEpoch } from "./timezone";

/** "2026-12" for a year and a 0-11 month: the `?month=` wire value and the `usage.period` key. */
export const monthKey = (year: number, month: number): string =>
  `${year}-${String(month + 1).padStart(2, "0")}`;

/** The inverse of `monthKey`; anything but "YYYY-MM" with a month 01..12 is null. */
export function parseMonthKey(value: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const month = match ? Number(match[2]) - 1 : -1;
  return match && month >= 0 && month <= 11 ? { year: Number(match[1]), month } : null;
}

/**
 * Janela do mês em epoch-ms. `timeZone` decide onde o mês começa e termina: sem ele vale o fuso do
 * runtime, e no Worker (UTC) uma tarefa das 23h do dia 31 cairia no mês seguinte para quem está a
 * oeste de Greenwich.
 */
export const startOfMonthMs = (d: Date, timeZone?: string): number =>
  timeZone
    ? zonedEpoch(
        { year: d.getFullYear(), month: d.getMonth(), day: 1, hour: 0, minute: 0, second: 0 },
        timeZone,
      )
    : new Date(d.getFullYear(), d.getMonth(), 1).getTime();

export const endOfMonthMs = (d: Date, timeZone?: string): number =>
  timeZone
    ? zonedEpoch(
        {
          year: d.getFullYear(),
          month: d.getMonth(),
          day: daysInMonth(d.getFullYear(), d.getMonth()),
          hour: 23,
          minute: 59,
          second: 59,
          ms: 999,
        },
        timeZone,
      )
    : new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
