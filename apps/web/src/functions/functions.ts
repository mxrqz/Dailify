import { TaskProps } from "@/types/types";
import { format, isSameDay } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";

export const returnFractedDate = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return { day, month, year };
};

export function getTime(
  time: number,
  format: "{hours, minutes}",
): { hours: number; minutes: number };
export function getTime(time: number, format: "HH:MM"): string;
export function getTime(time: number, format: "{hours, minutes}" | "HH:MM") {
  const date = new Date(time);
  const hours = date.getHours();
  const minutes = date.getMinutes();

  if (format === "{hours, minutes}") return { hours, minutes };
  if (format === "HH:MM") {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return "";
}

export const formatDateByLocale = (date: Date, locale: string) => {
  const dateLocale = locale.startsWith("pt") ? ptBR : enUS;
  return format(date, "PPPP", { locale: dateLocale });
};

export function getCompletionDate(task: TaskProps, selectedDay: Date) {
  if (!Array.isArray(task.completed)) return;
  const haveBeenCompletedToday = task.completed.some(
    (completedAt) => format(new Date(completedAt), "P") === format(selectedDay, "P"),
  )
    ? true
    : false;

  return haveBeenCompletedToday;
}

export function getTasksForDay(tasks: TaskProps[], day: Date): TaskProps[] {
  return tasks.filter((task) => isSameDay(new Date(task.date), day));
}

/** Append `task` to the list, or replace the existing entry with the same id. */
export function upsertTaskById(tasks: TaskProps[], task: TaskProps): TaskProps[] {
  const i = tasks.findIndex((t) => t.id === task.id);
  if (i === -1) return [...tasks, task];
  const next = [...tasks];
  next[i] = task;
  return next;
}

export function getNextTask(currentMonthTasks: TaskProps[]) {
  const now = Date.now();
  const orderedTasks = [...currentMonthTasks].sort((a, b) => a.date - b.date);
  const nextTask = orderedTasks.find((task) => task.date > now);

  return nextTask;
}

export function isTaskModified(task: TaskProps, updated: TaskProps): boolean {
  if (task.title !== updated.title) return true;
  if (task.description !== updated.description) return true;
  if (task.duration !== updated.duration) return true;
  if (task.priority !== updated.priority) return true;
  if (JSON.stringify(task.tags) !== JSON.stringify(updated.tags)) return true;

  if (task.date !== updated.date) return true;
  // alert falls back to date on both sides so a task without an alert isn't flagged as changed
  if ((task.alert ?? task.date) !== (updated.alert ?? updated.date)) return true;

  const isRepeatChanged = JSON.stringify(task.repeat) !== JSON.stringify(updated.repeat);
  if (isRepeatChanged) return true;

  return false;
}

export function unixToDate(unix: number): Date {
  return new Date(unix * 1000);
}
