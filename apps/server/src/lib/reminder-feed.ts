import {
  doneThisPeriod,
  expandRecurringTask,
  zonedParts,
  type Reminder,
  type Task,
  type WeekStart,
} from "@dailify/shared";
import { monthsTouching } from "./occurrence-alert";

export const FEED_HORIZON_MS = 14 * 24 * 60 * 60 * 1000;
// Android allows 500 pending alarms per app; the feed refreshes long before 100 run out.
export const FEED_MAX = 100;

const dayKey = (ms: number, timeZone: string) => {
  const p = zonedParts(ms, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
};

/**
 * The alerts due in `(now, now + FEED_HORIZON_MS]`, one per occurrence, each alert keeping the
 * series' `alert - date` offset. Skips what is already done: a one-off with any completion, a dated
 * occurrence completed on its day, an undated one completed in its period.
 */
export function reminderFeed(
  tasks: Task[],
  now: number,
  timeZone: string,
  weekStart: WeekStart,
): Reminder[] {
  const end = now + FEED_HORIZON_MS;
  const months = monthsTouching(end, FEED_HORIZON_MS, timeZone);
  const out: Reminder[] = [];

  for (const task of tasks) {
    if (task.alert === undefined) continue;
    const offset = task.alert - task.date;
    const instances =
      task.repeat === "Off"
        ? task.completed.length
          ? []
          : [task]
        : [task, ...months.flatMap((month) => expandRecurringTask(task, month, timeZone))];

    for (const instance of instances) {
      const fireAt = instance.date + offset;
      if (fireAt <= now || fireAt > end) continue;
      if (task.repeat !== "Off") {
        const done = task.undated
          ? doneThisPeriod(task, fireAt, weekStart, timeZone)
          : task.completed.some((c) => dayKey(c, timeZone) === dayKey(instance.date, timeZone));
        if (done) continue;
      }
      out.push({ id: `${task.id}:${fireAt}`, title: task.title, at: instance.date, fireAt });
    }
  }

  return out.sort((a, b) => a.fireAt - b.fireAt).slice(0, FEED_MAX);
}
