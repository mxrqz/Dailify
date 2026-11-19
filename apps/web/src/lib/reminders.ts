import { isTauri } from "@/lib/platform";

/** What the Android `reminders` plugin reports (`src-tauri/plugins/reminders`). */
export interface ReminderStatus {
  configured: boolean;
  notifications: "granted" | "denied" | "prompt";
  /** "Alarms & reminders" granted: without it a reminder may fire up to an hour late. */
  exact: boolean;
}

/** Local alarms replace Web Push only in the Android app: its WebView can't receive push. */
export const nativeReminders = (): boolean =>
  isTauri() && typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(`plugin:reminders|${command}`, args);
}

export const reminderStatus = () => call<ReminderStatus>("status");
export const permitReminders = () => call<ReminderStatus>("permit");
export const configureReminders = (apiUrl: string, token: string) =>
  call<void>("configure", { apiUrl, token });
export const openExactAlarmSettings = () => call<void>("settings");

/** Fire-and-forget: re-reads the feed in the background (a no-op when not configured). */
export function refreshReminders(): void {
  if (nativeReminders()) void call("refresh").catch(() => undefined);
}

/** Drops this device's alarms and feed token (the server revokes it with the session). */
export async function clearReminders(): Promise<void> {
  if (nativeReminders()) await call("clear").catch(() => undefined);
}
