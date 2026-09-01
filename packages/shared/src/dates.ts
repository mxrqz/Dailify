import { daysInMonth, zonedEpoch } from "./timezone";

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
