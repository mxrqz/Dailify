import type { SetStateAction } from "react";
import { addDays, startOfMonth } from "date-fns";
import { seriesOf } from "@dailify/shared";
import type { Task } from "@dailify/shared";

import { getTasksForMonth, syncTasks } from "./api";
import type { ApiError } from "./api";
import { initialMonths, mergeMonth } from "./functions";
import { loadLocal, saveMeta, saveRows, updateQueue, type LocalData } from "./local-db";
import { dropLegacy, readLegacy, readQueue, restoreQueue } from "./offline";
import { addMonth, applySync, applyWrite, viewOf, windowStart } from "./task-sync";
import type { RowChanges, TaskState } from "./task-sync";
import { zoned } from "./zone";

/**
 * The one door to the tasks: stored rows (IndexedDB), the lists the app reads, every write
 * (`setDated`/`setUndated`, behind the context's `setTasks`/`setUndatedTasks`) and the pull.
 * `dated`/`undated` stay `undefined` until this user's rows or first pull arrive.
 */
export interface TaskSnapshot {
  dated: Task[] | undefined;
  undated: Task[] | undefined;
  /** Month starts the agenda expands, in order; writers re-expand series over them. */
  months: Date[];
}

// A write still in flight when a pull starts may not have reached the server's read yet.
const IN_FLIGHT_MS = 15_000;

let userId: string | undefined;
let opening: Promise<void> | undefined;
let state: TaskState = { rows: new Map(), dated: [], undated: [] };
let ready = false;
let cursor: string | undefined;
let snapshot: TaskSnapshot = { dated: undefined, undated: undefined, months: [] };
// Last local write per id: a pull doesn't override it while the write may still be landing.
const touchedAt = new Map<string, number>();
const olderMonths = new Map<number, Promise<ApiError | undefined>>();
const listeners = new Set<() => void>();

function emit(): void {
  snapshot = {
    dated: ready ? state.dated : undefined,
    undated: ready ? state.undated : undefined,
    months: snapshot.months,
  };
  for (const listener of listeners) listener();
}

export const subscribeTasks = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

export const tasksSnapshot = (): TaskSnapshot => snapshot;

const persist = (changes: RowChanges) => {
  if (!userId || (!changes.put.length && !changes.drop.length && !changes.replace)) return;
  void saveRows(userId, changes.put, changes.drop, changes.replace);
};

// The localStorage copies predate IndexedDB: an expanded agenda folds back to rows by id.
function migrate(id: string, stored: LocalData | undefined): LocalData {
  const legacy = readLegacy(id);
  if (!legacy.tasks && !legacy.undated && !legacy.outbox) return stored ?? { rows: [] };
  const rows = new Map(
    [...(legacy.tasks ?? []).map(seriesOf), ...(legacy.undated ?? [])].map((t) => [t.id, t]),
  );
  const data: LocalData = {
    rows: stored?.rows.length ? stored.rows : [...rows.values()],
    queue: [...(stored?.queue ?? []), ...(legacy.outbox ?? [])],
    cursor: stored?.cursor,
  };
  // Kept in localStorage until IndexedDB holds them: losing a queued write is the one real loss.
  void Promise.all([saveRows(id, data.rows, []), updateQueue(id, () => data.queue ?? [])]).then(
    ([rows, queue]) => {
      if (rows && queue) dropLegacy(id);
    },
  );
  return data;
}

/** Switches the store to `id` (an account switch clears the previous user's lists) and paints its rows. */
export function openTasks(id: string): Promise<void> {
  if (id === userId && opening) return opening;
  userId = id;
  state = { rows: new Map(), dated: [], undated: [] };
  ready = false;
  cursor = undefined;
  touchedAt.clear();
  olderMonths.clear();
  snapshot = { dated: undefined, undated: undefined, months: initialMonths(zoned()) };
  emit();
  opening = loadLocal(id).then((stored) => {
    if (userId !== id) return;
    const data = migrate(id, stored);
    restoreQueue(id, data.queue ?? readQueue(id));
    cursor = data.cursor;
    if (!data.rows.length) return;
    const rows = new Map(data.rows.map((t) => [t.id, t]));
    state = { rows, ...viewOf(rows.values(), snapshot.months) };
    ready = true;
    emit();
  });
  return opening;
}

function write(list: "dated" | "undated", action: SetStateAction<Task[] | undefined>): void {
  const current = list === "dated" ? snapshot.dated : snapshot.undated;
  const next = typeof action === "function" ? action(current) : action;
  if (!next || next === current) return;
  const out = applyWrite(state, list, next, {
    months: snapshot.months,
    start: windowStart(Date.now()),
  });
  const now = Date.now();
  for (const id of out.touched) touchedAt.set(id, now);
  state = out.state;
  // The other list may still be unread: a write fills it with an empty one, like the old setters.
  ready = true;
  persist(out.changes);
  emit();
}

export const setDated = (action: SetStateAction<Task[] | undefined>) => write("dated", action);
export const setUndated = (action: SetStateAction<Task[] | undefined>) => write("undated", action);

let pulling: Promise<ApiError | undefined> | undefined;
let pullAgain = false;

/**
 * Pulls the changes since the cursor (all of the window on the first run or an expired cursor).
 * Single-flight; a call during a pull runs one more right after, since it may follow a write.
 */
export function pullTasks(): Promise<ApiError | undefined> {
  if (pulling) {
    pullAgain = true;
    return pulling;
  }
  pulling = pullOnce().finally(() => {
    pulling = undefined;
    if (pullAgain) {
      pullAgain = false;
      void pullTasks();
    }
  });
  return pulling;
}

async function pullOnce(): Promise<ApiError | undefined> {
  const id = userId;
  if (!id) return;
  await opening;
  const startedAt = Date.now();
  const { sync, error } = await syncTasks(cursor);
  if (error || !sync) return error;
  if (userId !== id) return;
  const keep = new Set(readQueue(id).map((m) => m.taskId));
  for (const [taskId, at] of touchedAt) if (at >= startedAt - IN_FLIGHT_MS) keep.add(taskId);
  const out = applySync(state, sync, {
    keep,
    months: snapshot.months,
    start: windowStart(Date.now()),
  });
  state = out.state;
  ready = true;
  if (!out.held) cursor = sync.cursor;
  persist(out.changes);
  void saveMeta(id, sync.full ? { cursor, pulledAt: Date.now() } : { cursor });
  emit();
}

const addMonthKey = (month: Date) => {
  snapshot = {
    ...snapshot,
    months: [...snapshot.months, month].sort((a, b) => a.getTime() - b.getTime()),
  };
};

/**
 * Shows `month` in the agenda. Inside the window it is local (the series expand); an older month
 * comes from GET /tasks?month= and stays in memory only, never stored or synced.
 */
export function loadTaskMonth(date: Date): Promise<ApiError | undefined> {
  const month = startOfMonth(date);
  const key = month.getTime();
  if (snapshot.months.some((m) => m.getTime() === key)) return Promise.resolve(undefined);
  if (key >= windowStart(Date.now())) {
    addMonthKey(month);
    state = addMonth(state, month);
    emit();
    return Promise.resolve(undefined);
  }
  const pending = olderMonths.get(key);
  if (pending) return pending;
  const id = userId;
  // ponytail: replaces the month's entries with the server's even for a write still queued; protect
  // pending ids here as the pull does if editing old months offline turns out to matter.
  const request = getTasksForMonth(month).then(({ tasks, error }) => {
    olderMonths.delete(key);
    if (error || userId !== id || snapshot.months.some((m) => m.getTime() === key)) return error;
    addMonthKey(month);
    state = { ...state, dated: mergeMonth(state.dated, month, tasks) };
    ready = true;
    emit();
  });
  olderMonths.set(key, request);
  return request;
}

/** A new app zone moves day and month edges: the loaded months are re-expanded from the rows. */
export function rezoneTasks(): void {
  // Mid-month (+14 days) is still the same month in any zone; its first instant isn't.
  const months = snapshot.months.map((m) => startOfMonth(zoned(addDays(m, 14))));
  const inside = months.filter((m) => +m >= windowStart(Date.now()));
  olderMonths.clear();
  snapshot = { ...snapshot, months: inside.length ? inside : initialMonths(zoned()) };
  state = { rows: state.rows, ...viewOf(state.rows.values(), snapshot.months) };
  emit();
}
