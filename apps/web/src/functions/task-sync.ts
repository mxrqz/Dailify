import { startOfDay } from "date-fns";
import { SYNC_WINDOW_DAYS, expandRecurringTask, seriesOf } from "@dailify/shared";
import type { Task, TaskSync } from "@dailify/shared";

import { swapTasks, swapUndated } from "./task-lists";
import { appTimeZone, zoned } from "./zone";

/**
 * The local task model. `rows` are stored rows by id (series unexpanded), what IndexedDB keeps;
 * `dated` and `undated` are the lists the app reads (`dated` = the series expanded over the loaded
 * months, plus older months fetched by month, in memory only).
 */
export interface TaskState {
  rows: Map<string, Task>;
  dated: Task[];
  undated: Task[];
}

/** What a change persists: rows to put and ids to delete; `replace` clears the store first. */
export interface RowChanges {
  put: Task[];
  drop: string[];
  replace?: boolean;
}

/** Start of the synced window (the server's full pull): its day, SYNC_WINDOW_DAYS back, in the app zone. */
export const windowStart = (now: number): number =>
  +startOfDay(zoned(now - SYNC_WINDOW_DAYS * 86_400_000));

/** Rows the sync keeps: undated, one-offs from `start`, series not ended before it. */
export const inWindow = (t: Task, start: number): boolean =>
  !!t.undated || t.date >= start || (t.repeat !== "Off" && (t.repeatUntil ?? Infinity) >= start);

/** A stored row as the agenda lists it: the row itself, plus its occurrences in `months`. */
const expand = (row: Task, months: Date[]): Task[] =>
  row.repeat === "Off"
    ? [row]
    : [row, ...months.flatMap((m) => expandRecurringTask(row, m, appTimeZone()))];

export function viewOf(rows: Iterable<Task>, months: Date[]): Omit<TaskState, "rows"> {
  const all = [...rows];
  return {
    dated: all.filter((t) => !t.undated).flatMap((t) => expand(t, months)),
    undated: all.filter((t) => t.undated),
  };
}

/** Ids whose entries differ between two versions of a list (entries are compared by reference). */
export function touchedIds(prev: Task[], next: Task[]): Set<string> {
  const before = new Set(prev);
  const after = new Set(next);
  const ids = new Set<string>();
  for (const t of next) if (!before.has(t)) ids.add(t.id);
  for (const t of prev) if (!after.has(t)) ids.add(t.id);
  return ids;
}

/**
 * The stored row behind one id's agenda entries. An occurrence the list dropped (a deleted "only
 * this one", still queued) becomes an exdate, so a re-expansion doesn't bring it back.
 */
export function rowOf(entries: Task[], months: Date[]): Task {
  const series = entries.find((t) => t.seriesStart === undefined) ?? seriesOf(entries[0]);
  if (series.repeat === "Off") return series;
  const present = new Set(entries.map((t) => t.date));
  const missing = expand(series, months)
    .map((t) => t.date)
    .filter((date) => !present.has(date));
  const exdates = [...(series.exdates ?? []).filter((d) => !present.has(d)), ...missing];
  return exdates.length || series.exdates?.length ? { ...series, exdates } : series;
}

/**
 * A write to one list (`setTasks`/`setUndatedTasks`): `next` becomes the list and every id it
 * touched gets its row back from it. An id gone from one list is deleted only if its row belongs to
 * that list, so moving a task between lists works in either order.
 */
export function applyWrite(
  state: TaskState,
  list: "dated" | "undated",
  next: Task[],
  { months, start }: { months: Date[]; start: number },
): { state: TaskState; changes: RowChanges; touched: string[] } {
  const touched = touchedIds(state[list], next);
  const rows = new Map(state.rows);
  const changes: RowChanges = { put: [], drop: [] };
  const byId = new Map<string, Task[]>();
  for (const t of next) if (touched.has(t.id)) byId.set(t.id, [...(byId.get(t.id) ?? []), t]);
  for (const id of touched) {
    const entries = byId.get(id);
    const row = entries && (list === "undated" ? entries[0] : rowOf(entries, months));
    if (row && inWindow(row, start)) {
      rows.set(id, row);
      changes.put.push(row);
    } else if (rows.has(id) && (row || !!rows.get(id)?.undated === (list === "undated"))) {
      rows.delete(id);
      changes.drop.push(id);
    }
  }
  return { state: { ...state, rows, [list]: next }, changes, touched: [...touched] };
}

/**
 * A pull. Full: the rows become the server's; incremental: upsert `tasks`, then drop `deleted`.
 * Ids in `keep` (an outbox entry or a write in flight) keep their local rows and entries; when the
 * server sent one of them, `held` says to keep the old cursor so the next pull sends it again.
 * Rows that fell out of the window are pruned; entries of older months stay on screen.
 */
export function applySync(
  state: TaskState,
  sync: TaskSync,
  { keep, months, start }: { keep: Set<string>; months: Date[]; start: number },
): { state: TaskState; changes: RowChanges; held: boolean } {
  const held = sync.tasks.some((t) => keep.has(t.id)) || sync.deleted.some((id) => keep.has(id));
  const incoming = sync.tasks.filter((t) => !keep.has(t.id));
  const fresh = incoming.filter((t) => inWindow(t, start));

  if (sync.full) {
    const kept = [...state.rows.values()].filter((t) => keep.has(t.id));
    const rows = new Map([...fresh, ...kept].map((t) => [t.id, t]));
    const view = viewOf(fresh, months);
    // Older months came by month and aren't in the pull: their entries stay until a reload.
    const older = (t: Task) => keep.has(t.id) || (t.date < start && !rows.has(t.id));
    return {
      state: {
        rows,
        dated: [...view.dated, ...state.dated.filter(older)],
        undated: [...view.undated, ...state.undated.filter((t) => keep.has(t.id))],
      },
      changes: { put: [...rows.values()], drop: [], replace: true },
      held,
    };
  }

  const gone = sync.deleted.filter((id) => !keep.has(id));
  const changed = [...incoming.map((t) => t.id), ...gone];
  const rows = new Map(state.rows);
  for (const id of changed) rows.delete(id);
  for (const t of fresh) rows.set(t.id, t);
  const aged = [...rows.values()].filter((t) => !inWindow(t, start) && !keep.has(t.id));
  for (const t of aged) rows.delete(t.id);
  return {
    state: {
      rows,
      dated: swapTasks(state.dated, changed, incoming, months),
      undated: swapUndated(state.undated, changed, incoming),
    },
    changes: {
      put: fresh,
      drop: [...changed.filter((id) => !rows.has(id)), ...aged.map((t) => t.id)],
    },
    held,
  };
}

/** A month the agenda now shows: every stored series gains its occurrences there. */
export function addMonth(state: TaskState, month: Date): TaskState {
  const series = [...state.rows.values()].filter((t) => !t.undated && t.repeat !== "Off");
  return {
    ...state,
    dated: [...state.dated, ...series.flatMap((t) => expandRecurringTask(t, month, appTimeZone()))],
  };
}
