import { TaskProps, PermissionsProps, Entitlements } from "@/types/types";
import { format, isSameDay, endOfMonth } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { Timestamp } from "firebase/firestore";
import { weekDays } from "@/consts/conts";

/** Normalize a Date | Firestore Timestamp to a JS Date. Use this before ANY date op. */
export function toJsDate(value: Date | Timestamp): Date {
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

/**
 * Derives feature entitlements from the server-provided permissions (capability-based — never the
 * plan name). `permissions === undefined` = not loaded yet: premium features default OFF (so they
 * don't flash), but task creation is NOT blocked (don't lock out a paying user mid-load). The client
 * gate is UX only — the server (d69.5) is the real enforcement.
 */
export function computeEntitlements(
  permissions: PermissionsProps | undefined,
  tasksUsed: number,
): Entitlements {
  const monthlyLimit = permissions?.taskLimits.monthly ?? -1;
  const recurringLimit = permissions?.taskLimits.recurring ?? 0;
  const unlimited = monthlyLimit < 0;
  const remaining = unlimited ? Infinity : Math.max(0, monthlyLimit - tasksUsed);

  return {
    loading: permissions === undefined,
    voice: permissions?.features.voiceCreation ?? false,
    recurrence: recurringLimit !== 0, // 0 = not allowed; -1 (unlimited) or >0 = allowed
    monthlyLimit,
    unlimited,
    tasksUsed,
    remaining,
    canCreateTask: unlimited || remaining > 0,
  };
}

/** Coerces an unknown repeat value (e.g. from the voice API) into a valid TaskProps["repeat"]. */
export function normalizeRepeat(value: unknown): TaskProps["repeat"] {
  if (value === "Off" || value === "Daily" || value === "Monthly" || value === "Yearly") {
    return value;
  }
  if (value && typeof value === "object" && "Weekly" in value) {
    const weekly = value.Weekly;
    if (Array.isArray(weekly)) return { Weekly: weekly };
  }
  return "Off";
}

/** Append `task` to the list, or replace the existing entry with the same id. */
export function upsertTaskById(tasks: TaskProps[], task: TaskProps): TaskProps[] {
  const i = tasks.findIndex((t) => t.id === task.id);
  if (i === -1) return [...tasks, task];
  const next = [...tasks];
  next[i] = task;
  return next;
}

/**
 * Expands one recurring task into the concrete instances that fall in `month`.
 * Instances are built in the *viewed* month (not the original one) and carry JS Dates.
 * The original day in its creation month is left to the stored task doc, so it is not
 * duplicated here (creation month is skipped for Monthly/Yearly and the original day is
 * skipped for Daily/Weekly).
 */
export function expandRecurringTask(task: TaskProps, month: Date): TaskProps[] {
  const original = toJsDate(task.date);
  const year = month.getFullYear();
  const mon = month.getMonth();
  const daysInMonth = endOfMonth(month).getDate();

  // Nothing recurs before the task existed.
  if (endOfMonth(month) < original) return [];

  const inCreationMonth = original.getFullYear() === year && original.getMonth() === mon;
  const at = (day: number): Date =>
    new Date(year, mon, day, original.getHours(), original.getMinutes(), original.getSeconds());
  const instance = (date: Date): TaskProps => ({ ...task, date });

  const repeat = task.repeat;

  if (typeof repeat === "string") {
    switch (repeat) {
      case "Daily": {
        const out: TaskProps[] = [];
        for (let d = inCreationMonth ? original.getDate() + 1 : 1; d <= daysInMonth; d++) {
          out.push(instance(at(d)));
        }
        return out;
      }
      case "Monthly": {
        if (inCreationMonth) return [];
        return [instance(at(Math.min(original.getDate(), daysInMonth)))];
      }
      case "Yearly": {
        if (original.getMonth() !== mon || original.getFullYear() === year) return [];
        return [instance(at(Math.min(original.getDate(), daysInMonth)))];
      }
      default:
        return []; // "Off"
    }
  }

  // Weekly — repeat.Weekly is a list of weekday names ("Monday", …), matched via weekDays index.
  const repeatDays = repeat?.Weekly;
  if (!Array.isArray(repeatDays) || repeatDays.length === 0) return [];

  const out: TaskProps[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (inCreationMonth && d === original.getDate()) continue; // stored doc covers this day
    const date = at(d);
    if (repeatDays.includes(weekDays[date.getDay()])) out.push(instance(date));
  }
  return out;
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
