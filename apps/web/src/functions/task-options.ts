// The choice lists of the task editors. Each keeps the current value when it's off the scale, so a
// value set elsewhere (the parser, the Google Calendar) never snaps to a neighbour.

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
