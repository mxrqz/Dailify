import type { Task } from "@dailify/shared";

/** A day's row: a task at `at` minutes past midnight, or today's now line. */
export type Row = { at: number; task: Task; hour?: string } | { at: number; now: true };

const hourOf = (at: number) => `${String(Math.floor(at / 60)).padStart(2, "0")}:00`;

/**
 * Clock order with the done tasks settled after the open ones and the now line. `hour` ("16:00")
 * marks the first row of each hour run, so a done task at the end labels its own hour again.
 */
export function dayRows(rows: Row[], done: (task: Task) => boolean): Row[] {
  const isDone = (row: Row) => "task" in row && done(row.task);
  const sorted = [...rows].sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || a.at - b.at);
  let last: string | undefined;
  let lastDone = false;
  return sorted.map((row) => {
    if (!("task" in row)) return row;
    const hour = hourOf(row.at);
    const first = hour !== last || isDone(row) !== lastDone;
    last = hour;
    lastDone = isDone(row);
    return { ...row, hour: first ? hour : undefined };
  });
}

/** Every task of the day is done: the one moment the agenda celebrates. */
export const isDayZeroed = (tasks: readonly Task[], done: (task: Task) => boolean): boolean =>
  tasks.length > 0 && tasks.every(done);
