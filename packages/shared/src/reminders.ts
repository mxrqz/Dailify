/** One occurrence the Android app arms as a local alarm. `id` is `<taskId>:<fireAt>`. */
export interface Reminder {
  id: string;
  title: string;
  /** The task's own time, shown in the notification body. */
  at: number; // epoch ms
  fireAt: number; // epoch ms
}

/** `GET /reminders/feed`, read by the Android background sync with a feed token. */
export interface ReminderFeed {
  reminders: Reminder[];
}

/** `POST /reminders/token`: a read-only feed token for this login session. */
export interface ReminderToken {
  token: string;
}
