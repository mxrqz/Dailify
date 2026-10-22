import { doneThisPeriod, type Task, type WeekStart } from "@dailify/shared";

/** O período (dia/semana/mês) é do fuso do usuário, não do UTC do Worker. */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const upsertUndated = (list: Task[], task: Task): Task[] =>
  list.some((t) => t.id === task.id)
    ? list.map((t) => (t.id === task.id ? task : t))
    : [...list, task];

export const removeUndated = (list: Task[], id: string): Task[] => list.filter((t) => t.id !== id);

/** Série fica sempre (marcada ou não, o período decide); avulsa concluída some. */
export function splitUndated(list: Task[]): { recurring: Task[]; todo: Task[] } {
  const byDate = [...list].sort((a, b) => a.date - b.date);
  return {
    recurring: byDate.filter((t) => t.repeat !== "Off"),
    todo: byDate.filter((t) => t.repeat === "Off" && t.completed.length === 0),
  };
}

/** O que ainda pede ação: avulsas abertas + séries não feitas neste período. */
export function pendingUndated(list: Task[], now: number, weekStart: WeekStart): number {
  const { recurring, todo } = splitUndated(list);
  const tz = browserTimeZone();
  return recurring.filter((t) => !doneThisPeriod(t, now, weekStart, tz)).length + todo.length;
}
