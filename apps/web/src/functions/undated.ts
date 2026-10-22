import type { Task, WeekStart } from "@dailify/shared";

export const upsertUndated = (list: Task[], task: Task): Task[] =>
  list.some((t) => t.id === task.id)
    ? list.map((t) => (t.id === task.id ? task : t))
    : [...list, task];

export const removeUndated = (list: Task[], id: string): Task[] => list.filter((t) => t.id !== id);

/** Série fica sempre (marcada ou não, o período decide); avulsa concluída some. */
/* eslint-disable @typescript-eslint/no-unused-vars -- assinatura do contrato; "feito no período" é da UI */
export function splitUndated(
  list: Task[],
  _now: number,
  _weekStart: WeekStart,
  _tz: string,
): { recurring: Task[]; todo: Task[] } {
  const byDate = [...list].sort((a, b) => a.date - b.date);
  return {
    recurring: byDate.filter((t) => t.repeat !== "Off"),
    todo: byDate.filter((t) => t.repeat === "Off" && t.completed.length === 0),
  };
}
/* eslint-enable @typescript-eslint/no-unused-vars */
