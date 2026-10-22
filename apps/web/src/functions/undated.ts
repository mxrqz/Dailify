import type { Task } from "@dailify/shared";

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
