// The choice lists of the task editors. Each keeps the current value when it's off the scale, so a
// value set elsewhere (the parser, the Google Calendar) never snaps to a neighbour.

import type { Task } from "@dailify/shared";

const MINUTE_STEP = 5;

/** The quick-capture duration steps. */
export const DURATIONS = ["10m", "15m", "30m", "45m", "1h", "1h30m", "2h"];

/** `DURATIONS`, with the current duration first when it isn't one of them. */
export const durationOptions = (current: string): string[] =>
  DURATIONS.includes(current) ? DURATIONS : [current, ...DURATIONS];

/** Minutes in steps of 5, plus the current one in order (16:37 doesn't become 16:35 by itself). */
export function minuteOptions(current: number): number[] {
  const steps = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
  return steps.includes(current) ? steps : [...steps, current].sort((a, b) => a - b);
}

/** The reminder choices of a dated task, in minutes before it. */
export const REMINDER_OFFSETS = [0, 5, 10, 15, 30, 60, 1440] as const;
export type ReminderOffset = (typeof REMINDER_OFFSETS)[number];

export const isReminderOffset = (before: number | undefined): before is ReminderOffset =>
  REMINDER_OFFSETS.some((offset) => offset === before);

/** `REMINDER_OFFSETS`, with an off-list current value first. */
export const reminderOptions = (current: number | undefined): number[] =>
  current === undefined || isReminderOffset(current)
    ? [...REMINDER_OFFSETS]
    : [current, ...REMINDER_OFFSETS];

/**
 * Minutes from a task's alert to its start. An instance carries its series' alert, so it measures
 * from the anchor (`seriesStart`).
 */
export const reminderBefore = (
  task: Pick<Task, "date" | "alert" | "seriesStart">,
): number | undefined =>
  task.alert === undefined
    ? undefined
    : Math.round(((task.seriesStart ?? task.date) - task.alert) / 60_000);
