/** The `Task.duration` format: "10m", "1h", "1h30m". */
export const DEFAULT_DURATION = "10m";

export const DURATION_RE = /^(?:\d{1,3}h)?(?:\d{1,4}m)?$/;

export const isDuration = (value: unknown): value is string =>
  typeof value === "string" && value !== "" && DURATION_RE.test(value);

/** "1h30m" → 90; empty or unreadable → the minutes of `DEFAULT_DURATION`. */
export function durationMinutes(duration: string): number {
  const h = /(\d+)\s*h/.exec(duration);
  const m = /(\d+)\s*m/.exec(duration);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0) || durationMinutes(DEFAULT_DURATION);
}

/** 90 → "1h30m", 60 → "1h", 45 → "45m", 0 → "0m": the inverse of `durationMinutes`. */
export function minutesToDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h ? `${h}h` : ""}${m || !h ? `${m}m` : ""}`;
}
