import type { Task } from "@dailify/shared";

/** A day's row: a task at `at` minutes past midnight, or today's now line. */
export type Row = { at: number; task: Task } | { at: number; now: true };

/** Clock order with the done tasks settled after the open ones and the now line. */
export function dayRows(rows: Row[], done: (task: Task) => boolean): Row[] {
  const isDone = (row: Row) => "task" in row && done(row.task);
  return [...rows].sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || a.at - b.at);
}

/** Every task of the day is done: the one moment the agenda celebrates. */
export const isDayZeroed = (tasks: readonly Task[], done: (task: Task) => boolean): boolean =>
  tasks.length > 0 && tasks.every(done);
