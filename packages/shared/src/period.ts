import type { Repeat, Task } from "./types";
import { zonedEpoch, zonedParts } from "./timezone";

/** 0 = domingo … 6 = sábado, como em `Date#getDay`. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DEFAULT_WEEK_START: WeekStart = 1;

/** Hora em que um período vira: antes das 6h ainda conta como o dia anterior. */
export const PERIOD_ROLLOVER_HOUR = 6;

export function isWeekStart(value: unknown): value is WeekStart {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 6
  );
}


/** Início (às 6h, no fuso) do período de recorrência que contém `now`. */
export function periodStart(
  repeat: Exclude<Repeat, "Off">,
  now: number,
  weekStart: WeekStart,
  timeZone: string,
): number {
  const parts = zonedParts(now, timeZone);
  // Antes das 6h o período ainda é o de ontem; recuar o dia civil (não 6h) respeita DST.
  const back = parts.hour < PERIOD_ROLLOVER_HOUR ? 1 : 0;
  const d0 = new Date(Date.UTC(parts.year, parts.month, parts.day - back));
  const year = d0.getUTCFullYear();
  const month = d0.getUTCMonth();
  const day = d0.getUTCDate();
  let start = { year, month, day };
  if (repeat === "Monthly") start = { year, month, day: 1 };
  else if (repeat === "Yearly") start = { year, month: 0, day: 1 };
  else if (typeof repeat === "object") {
    const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
    // Date.UTC normaliza dia <= 0 para o mês anterior.
    const d = new Date(
      Date.UTC(year, month, day - ((weekday - weekStart + 7) % 7)),
    );
    start = {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      day: d.getUTCDate(),
    };
  }
  return zonedEpoch(
    { ...start, hour: PERIOD_ROLLOVER_HOUR, minute: 0, second: 0 },
    timeZone,
  );
}

/** Alguma conclusão cai no período corrente? `false` para tarefa sem repetição. */
export function doneThisPeriod(
  task: Pick<Task, "repeat" | "completed">,
  now: number,
  weekStart: WeekStart,
  timeZone: string,
): boolean {
  if (task.repeat === "Off") return false;
  const start = periodStart(task.repeat, now, weekStart, timeZone);
  return task.completed.some((c) => c >= start);
}
