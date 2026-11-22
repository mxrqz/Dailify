import { isRecord } from "@dailify/shared";

export const EVENTS_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
export const TASKS_API = "https://tasks.googleapis.com/tasks/v1";

export const field = (v: unknown, key: string): unknown => (isRecord(v) ? v[key] : undefined);
export const text = (v: unknown, key: string): string | undefined => {
  const x = field(v, key);
  return typeof x === "string" ? x : undefined;
};

export const json = (method: string, body: object): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

/** The response's `updated` (RFC 3339): sync compares against it to spot its own echo. */
export const updatedOf = (body: unknown): number | undefined => {
  const at = Date.parse(text(body, "updated") ?? "");
  return Number.isNaN(at) ? undefined : at;
};
