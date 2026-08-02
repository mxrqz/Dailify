import { TaskProps } from "@/types/types";
import { format, isSameDay } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";

function toJsDate(value: Date | Timestamp): Date {
  return value instanceof Timestamp ? value.toDate() : value;
}

export const returnFractedDate = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return { day, month, year };
};

export function getTime(
  time: Timestamp | Date,
  format: "{hours, minutes}",
): { hours: number; minutes: number };
export function getTime(time: Timestamp | Date, format: "HH:MM"): string;
export function getTime(time: Timestamp | Date, format: "{hours, minutes}" | "HH:MM") {
  const hours = time instanceof Timestamp ? time.toDate().getHours() : time.getHours();
  const minutes = time instanceof Timestamp ? time.toDate().getMinutes() : time.getMinutes();

  if (format === "{hours, minutes}") return { hours, minutes };
  if (format === "HH:MM") {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return "";
}

// export const getTasksByDate = (tasks: any, year: number, month: number, day: number) => {
//     const yearStr = year.toString()
//     const monthStr = month.toString().padStart(2, "0")
//     const dayStr = day.toString().padStart(2, "0")

//     return tasks?.[yearStr]?.[monthStr]?.[dayStr] || {}
// };

export const formatDateByLocale = (date: Date, locale: string) => {
  const dateLocale = locale.startsWith("pt") ? ptBR : enUS;
  return format(date, "PPPP", { locale: dateLocale });
};

export function getCompletionDate(task: TaskProps, selectedDay: Date) {
  if (!Array.isArray(task.completed)) return;
  const taskCompletedDate = (task.completed as (Date | Timestamp)[]).map(toJsDate);
  const haveBeenCompletedToday = taskCompletedDate.some(
    (taskDate) => format(taskDate, "P") === format(selectedDay, "P"),
  )
    ? true
    : false;

  return haveBeenCompletedToday;
}

export function getTasksForDay(tasks: TaskProps[], day: Date): TaskProps[] {
  return tasks.filter((task) => isSameDay(toJsDate(task.date), day));
}

export function getNextTask(currentMonthTasks: TaskProps[]) {
  const now = new Date();
  const orderedTasks = [...currentMonthTasks].sort(
    (a, b) => toJsDate(a.date).getTime() - toJsDate(b.date).getTime(),
  );
  const nextTask = orderedTasks.find((task) => toJsDate(task.date).getTime() > now.getTime());

  return nextTask;
}

export function isTaskModified(task: TaskProps, updated: TaskProps): boolean {
  const normalizeDate = (d: Date | Timestamp | undefined) =>
    d == null ? undefined : toJsDate(d).getTime();

  if (task.title !== updated.title) return true;
  if (task.description !== updated.description) return true;
  if (task.duration !== updated.duration) return true;
  if (task.priority !== updated.priority) return true;
  if (JSON.stringify(task.tags) !== JSON.stringify(updated.tags)) return true;

  if (normalizeDate(task.date) !== normalizeDate(updated.date)) return true;
  // alert falls back to date on both sides so a task without an alert isn't flagged as changed
  if (normalizeDate(task.alert ?? task.date) !== normalizeDate(updated.alert ?? updated.date))
    return true;

  const isRepeatChanged = JSON.stringify(task.repeat) !== JSON.stringify(updated.repeat);
  if (isRepeatChanged) return true;

  return false;
}

export function unixToDate(unix: number): Date {
  return new Date(unix * 1000);
}
