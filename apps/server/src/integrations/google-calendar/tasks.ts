import {
  DEFAULT_DURATION,
  TASK_LIMITS,
  isoDate,
  zonedEpoch,
  zonedParts,
  type Task,
} from "@dailify/shared";
import {
  dropTasks,
  getLinkByExternal,
  importTask,
  saveTasksCursor,
  setRemoteState,
} from "../../db/calendar-sync";
import { setLinkState, setRemoteUpdated, type StoredLink } from "../../db/integrations";
import { appendCompletion, getTask, removeCompletions, updateTask } from "../../db/tasks";
import { newTaskId } from "../../lib/task-input";
import type { Ctx } from "../types";
import { TASKS_API, field, json, text, updatedOf } from "./api";

export const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

const DAY = 86_400_000;
// ponytail: completed tasks older than 30 days stay in Google; widen if people miss their history.
const DONE_WINDOW = 30 * DAY;
// ponytail: 10 pages x 100 per list; past it the rest of a list waits for its next edit.
const MAX_PAGES = 10;
// The cursor steps back a minute so an edit racing the pass comes twice, never zero times.
const SKEW = 60_000;

/** A Google task link: its external id is the API path, `lists/<list>/tasks/<task>`. */
export const isGoogleTask = (link: Pick<StoredLink, "externalId">) =>
  link.externalId.startsWith("lists/");

/** The raw `tasks.list` item, only what the sync reads. */
export interface RemoteTask {
  externalId: string;
  title: string;
  /** `YYYY-MM-DD`: Google keeps only the day of `due`. */
  due?: string;
  /** Completion instant; absent = needsAction. */
  done?: number;
  deleted: boolean;
  updated: number;
  url?: string;
}

export function readTask(raw: unknown, listId: string): RemoteTask | null {
  const id = text(raw, "id");
  if (!id) return null;
  const updated = Date.parse(text(raw, "updated") ?? "") || 0;
  const due = text(raw, "due")?.slice(0, 10);
  const url = text(raw, "webViewLink");
  return {
    externalId: `lists/${listId}/tasks/${id}`,
    title: (text(raw, "title")?.trim() || "Sem título").slice(0, TASK_LIMITS.titleMax),
    due: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : undefined,
    done:
      text(raw, "status") === "completed"
        ? Date.parse(text(raw, "completed") ?? "") || updated
        : undefined,
    deleted: field(raw, "deleted") === true,
    updated,
    url: url?.startsWith("https://") ? url : undefined,
  };
}

/**
 * Always Sem data, like an all-day Calendar event: a due day becomes the 09:00 anchor alert on it
 * (all-day on that day), no due leaves it "A qualquer hora".
 */
export function taskFields(
  t: RemoteTask,
  timeZone: string,
  fallbackDate: number,
): Pick<Task, "title" | "date" | "alert" | "duration" | "repeat" | "undated"> {
  const base = {
    title: t.title,
    duration: DEFAULT_DURATION,
    repeat: "Off" as const,
    undated: true,
  };
  if (!t.due) return { ...base, date: fallbackDate, alert: undefined };
  const [year, month, day] = t.due.split("-").map(Number);
  const anchor = zonedEpoch(
    { year, month: month - 1, day, hour: 9, minute: 0, second: 0 },
    timeZone,
  );
  return { ...base, date: anchor, alert: anchor };
}

/** The day the task sits on in Mewki (an undated one's alert, a dated one's date), as `YYYY-MM-DD`. */
function dayOf(task: Task, timeZone: string): string | undefined {
  const at = task.undated ? task.alert : task.date;
  return at === undefined ? undefined : isoDate(zonedParts(at, timeZone));
}

interface Pass {
  db: D1Database;
  userId: string;
  zone: string;
  now: number;
}

/** LWW like events: Google newer applies; Mewki newer keeps and marks the link `stale` (the resend). */
async function apply(s: Pass, t: RemoteTask): Promise<boolean> {
  const link = await getLinkByExternal(s.db, s.userId, t.externalId);
  if (t.deleted) {
    if (link) await dropTasks(s.db, s.userId, [link.taskId]);
    return false;
  }
  if (!link) {
    if (t.done !== undefined && t.done < s.now - DONE_WINDOW) return false;
    const id = newTaskId();
    const task: Task = {
      id,
      priority: 0,
      ...taskFields(t, s.zone, t.updated || s.now),
      links: t.url ? [t.url] : undefined,
      completed: t.done !== undefined ? [t.done] : [],
      updatedAt: t.updated || s.now,
    };
    const write = { taskId: id, externalId: t.externalId, url: t.url ?? "", timeZone: s.zone };
    await importTask(
      s.db,
      s.userId,
      task,
      { ...write, imported: true, readonly: false, remoteUpdated: t.updated },
      s.now,
    );
    return true;
  }

  if (link.remoteUpdated !== null && t.updated <= link.remoteUpdated) return false; // our echo
  const task = await getTask(s.db, s.userId, link.taskId);
  if (!task) {
    await dropTasks(s.db, s.userId, [link.taskId]);
    return false;
  }
  const state = { remoteUpdated: t.updated, readonly: false, silenceAlert: !!t.due };
  if ((task.updatedAt ?? 0) >= t.updated) {
    await setLinkState(s.db, s.userId, "google-calendar", task.id, { stale: true }, s.now);
    await setRemoteState(s.db, s.userId, task.id, { ...state, silenceAlert: false });
    return false;
  }
  // The day only moves when Google's due changed: a time picked in Mewki on that day stays.
  const mapped = taskFields(t, s.zone, task.date);
  const moved = dayOf(task, s.zone) !== t.due;
  await updateTask(s.db, s.userId, task.id, {
    title: mapped.title,
    ...(moved && { date: mapped.date, alert: mapped.alert, undated: true }),
    updatedAt: Math.max(t.updated, task.updatedAt ?? 0),
  });
  const done = task.completed.length > 0;
  if (t.done !== undefined && !done) await appendCompletion(s.db, s.userId, task.id, t.done);
  if (t.done === undefined && done)
    await removeCompletions(s.db, s.userId, task.id, 0, Number.MAX_SAFE_INTEGER);
  await setRemoteState(s.db, s.userId, task.id, state);
  return false;
}

async function listAll(ctx: Ctx, url: string, query: Record<string, string>): Promise<unknown[]> {
  const items: unknown[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      maxResults: "100",
      ...query,
      ...(pageToken && { pageToken }),
    });
    const res = await ctx.api(`${url}?${params}`);
    if (!res.ok) throw new Error(`Google Tasks ${res.status}: ${await res.text().catch(() => "")}`);
    const body: unknown = await res.json();
    const got = field(body, "items");
    if (Array.isArray(got)) items.push(...got);
    pageToken = text(body, "nextPageToken");
    if (!pageToken) break;
  }
  return items;
}

/**
 * Every list's tasks into Mewki: in full when `since` is null, else what changed after it
 * (deletions included). Answers how many were imported. Never calls the propagation.
 */
export async function syncTasks(ctx: Ctx, s: Pass, since: number | null): Promise<number> {
  const query = {
    showCompleted: "true",
    showHidden: "true",
    ...(since !== null && { showDeleted: "true", updatedMin: new Date(since).toISOString() }),
  };
  let imported = 0;
  for (const list of await listAll(ctx, `${TASKS_API}/users/@me/lists`, {})) {
    const listId = text(list, "id");
    if (!listId) continue;
    const items = await listAll(ctx, `${TASKS_API}/lists/${listId}/tasks`, query);
    for (const raw of items) {
      const t = readTask(raw, listId);
      if (t && (await apply(s, t))) imported++;
    }
  }
  await saveTasksCursor(s.db, s.userId, s.now - SKEW);
  return imported;
}

/**
 * Mewki -> Google for a task link: the title and completion only (due stays Google's). Deleting
 * in Mewki leaves the Google task and drops the link.
 */
export async function pushTask(
  ctx: Ctx,
  link: StoredLink,
  before: Task | null,
  after: Task | null,
): Promise<"unlink" | void> {
  if (!after) return "unlink";
  const done = after.completed.length > 0;
  const body = {
    ...((!before || before.title !== after.title) && { title: after.title }),
    ...((!before || before.completed.length > 0 !== done) &&
      (done ? { status: "completed" } : { status: "needsAction", completed: null })),
  };
  if (!Object.keys(body).length) return;
  const res = await ctx.api(`${TASKS_API}/${link.externalId}`, json("PATCH", body));
  if (res.status === 404 || res.status === 410) return "unlink";
  if (!res.ok) throw new Error(`Google Tasks ${res.status}: ${await res.text().catch(() => "")}`);
  const updated = updatedOf(await res.json().catch(() => null));
  if (updated !== undefined)
    await setRemoteUpdated(ctx.env.DB, ctx.userId, link.provider, link.taskId, updated);
}
