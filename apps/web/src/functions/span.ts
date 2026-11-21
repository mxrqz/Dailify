import { TASK_LIMITS, civilDay, durationMinutes, zonedParts, type Task } from "@dailify/shared";

type Civil = { year: number; month: number; day: number };

const keyOf = (p: Civil) => `${p.year}-${p.month}-${p.day}`;

/** The day-bucket key of an instant in `zone`. */
export const dayKey = (ms: number, zone: string): string => keyOf(zonedParts(ms, zone));

/** Calendar days `[date, date + duration)` touches in `zone`: 1 within a day, capped. */
export function spanLength(task: Pick<Task, "date" | "duration">, zone: string): number {
  const end = task.date + durationMinutes(task.duration) * 60_000;
  const days = civilDay(zonedParts(end - 1, zone)) - civilDay(zonedParts(task.date, zone)) + 1;
  return Math.min(Math.max(days, 1), TASK_LIMITS.spanDaysMax);
}

/** The bucket key of every day the task covers, its start day first. */
export function spanDayKeys(task: Pick<Task, "date" | "duration">, zone: string): string[] {
  const p = zonedParts(task.date, zone);
  return Array.from({ length: spanLength(task, zone) }, (_, i) => {
    // Civil-date arithmetic in UTC, so DST never skips or repeats a day.
    const d = new Date(Date.UTC(p.year, p.month, p.day + i));
    return keyOf({ year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() });
  });
}

/** Day `k` of `n` on the day holding `at`, for a task that crosses midnight; none within a day. */
export function spanOf(
  task: Pick<Task, "date" | "duration">,
  at: number,
  zone: string,
): { k: number; n: number } | undefined {
  const n = spanLength(task, zone);
  if (n < 2) return undefined;
  const k = civilDay(zonedParts(at, zone)) - civilDay(zonedParts(task.date, zone)) + 1;
  return k >= 1 && k <= n ? { k, n } : undefined;
}
