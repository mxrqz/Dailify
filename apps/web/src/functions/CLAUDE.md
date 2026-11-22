# apps/web/src/functions — data layer and pure web helpers

Repo-wide rules: [/RULES.md](../../../../RULES.md); what belongs here versus `lib/` or shared is
in [Where code goes](../../../../RULES.md#where-code-goes). Only local invariants follow.

## Modules

Each has a colocated `<module>.test.ts`, except `push.ts` and `local-db.ts` (covered by
`offline.test.ts` and `task-store.test.ts`).

- `api.ts`: the only HTTP boundary to `apps/server`. `push.ts`: Web Push for this device.
- `offline.ts`: outbox queue, last signed-in user, `newTaskId`, `clearLocal`, the legacy
  localStorage copies (`readLegacy`/`dropLegacy`).
- `local-db.ts`: one IndexedDB per user (below); `task-sync.ts`: the pure task reducer;
  `task-store.ts`: the module store over both, the one door to task data (below).
- `zone.ts`: the app zone as module state (`appTimeZone`/`setAppTimeZone`, `zoned`, `zonedAt`,
  `fromDateInput`), so the parser, the queue and the API read one zone.
- `functions.ts`: legacy grab-bag (`fill`, `formatClock`, `getTasksForDay`,
  `upsertTaskWithRecurrence`, `mergeMonth`, ...). No new exports; a new helper gets its own module.
- One concept each: `repeat-label` (+ `REPEAT_MODES`), `link-label` (+ `linkHost`,
  `normalizeUrl`), `quota-label` (+ `creditsLabel`), `count-label`, `date-label` (day and clock
  labels), `task-options` (editor choice lists), `task-lists` (`swapTasks`/`swapUndated`),
  `undated`, `span` (the days a task crossing midnight covers, "dia k de n"),
  `compose-input` (composer chip state: `onDay`, `markSegments`, `withEdits`; `fromWire` and
  `composeTaskInput` are shared's), `edit-input` (edit form to `TaskInput`, `buildEdit`), `billing-sections`,
  `revert-task`.
- Imports: shared, date libs, `@/consts`, `@/lib`, siblings, `components/*/copy.ts`, `import type`
  from components.
- A `month: Date` parameter (`getTasksForMonth`, `mergeMonth`, the `months` of
  `upsertTaskWithRecurrence`) must be a zoned month: its year and month are read in its own zone.

## api.ts contract

- Every endpoint wraps the private `request<T>()`, which never throws: a rejected fetch gives
  `{ offline: true }`, a non-2xx `{ status, code, message }`, a non-JSON body (a Worker 502 is HTML)
  `undefined`. Endpoints return `{ <noun>?: T; error?: ApiError }`; `message` is for a toast only.
- A 401 also fires `authClient.$store.notify("$sessionSignal")`, so the session gate re-reads.
  `errorBody` is a failed response's body: `createCalendarEvent` reads a 409 `already_linked`
  from it.
- Auth is `credentials: "include"` (web cookie) plus `authHeaders()` (Tauri bearer); no function
  takes a token. In PATCH bodies `null` clears and an absent key keeps (`updateTask`'s `alert`).
- `authed()` skips the JSON Content-Type for a `FormData` body (`createTaskVoice`).

Adding an endpoint: name the wire type in `@dailify/shared`
([TypeScript](../../../../RULES.md#typescript)); wrap `request<T>()` here and `encodeURIComponent`
every path segment; add the function to the `vi.mock("@/functions/api", () => api)` object of each
render test whose component now calls it (a factory mock throws on an export it lacks).
`api.test.ts` pins the `request()` contract with `vi.stubGlobal("fetch", ...)` plus
`vi.mock("@/lib/auth")`.

## Offline queue (`offline.ts`)

- `Mutation` replays existing routes: `create` (id from `newTaskId()`, which survives a missing
  `crypto.randomUUID` on plain http), `patch` (optional `occurrence`), `complete`, `uncomplete`
  (`day`, or `[day, until]` for an undated period), `delete`, `delete-occurrence`.
- `collapseQueue`: a `delete` drops its task's pending entries, and itself when a `create` was
  pending. The newest `complete`/`uncomplete` replaces a pending one only for the same day (the complete's
  stamp, the uncomplete's `day`, in the app zone) or inside an undated `[day, until]`. Patches
  merge per (task, occurrence); a series patch on a pending `create` folds into it.
  `delete-occurrence` is its own op so it never collapses like a delete.
- The queue is a per-user in-memory copy (`readQueue` is synchronous), filled from IndexedDB by
  `openTasks` (`restoreQueue`); every change also runs as one read-modify-write transaction there
  (`updateQueue`), so another tab's stored entries survive (and replay idempotently).
- `flushQueue` is single-flight per user (`flushing` map). The drain re-reads the queue every step,
  stops at the first offline or 401 (kept for the next sign-in) and drops what the server refused.
  Entries are removed by value, not index: in IndexedDB another tab may have sent the head.
- `dequeue` takes back a pending entry by value; `false` while a flush runs or once it's gone.
- `enqueue` doesn't collapse during a flush: a delete folded into an in-flight create is lost.
- `shouldQueue(error)` is the settle predicate (offline or 401), used by `drainQueue`, the write
  hooks and `edit-task.tsx` (`hooks/CLAUDE.md`).
- Storage names are a persisted contract (renaming drops queued writes): the IndexedDB
  `dailify:<userId>`, `dailify:last-user`, `mewki:mew:<userId>:v1` (`chatKey`, read by
  `components/mew-chat/thread.ts`), and the legacy `dailify:{tasks,outbox,undated}:<userId>` the
  migration reads; `clearLocal` removes all but device-wide ones
  ([Security](../../../../RULES.md#security-and-privacy)).

## Local database (`local-db.ts`)

- `dailify:<userId>`, version 1: `tasks` (stored rows, keyPath `id`), `outbox` (the queue under
  `queue`), `meta` (`cursor`, `pulledAt` of the last full pull). Plain IDB, no wrapper lib.
- Every call resolves `undefined` when IDB is missing or throws (private mode, node tests); the
  callers keep their in-memory copy, so the app runs without persistence. A schema change bumps
  `VERSION` and branches on `oldVersion` in `onupgradeneeded`.
- `deleteLocal` is synchronous so an open issued after it queues behind the delete. Tests use
  `import "fake-indexeddb/auto"`.

## Task store and sync (`task-store.ts`, `task-sync.ts`)

- State: `rows` (stored rows by id, series unexpanded, what IndexedDB keeps) and the lists the app
  reads, `dated` (series expanded over `months`) and `undated`. Rows stay inside the synced window
  (`inWindow`: undated, one-offs from `windowStart` = `SYNC_WINDOW_DAYS` back, live series); a month
  before it comes by `GET /tasks?month=` into `dated` only, never stored nor synced.
- Writes: `setDated`/`setUndated` take the whole new list; `applyWrite` finds the touched ids by
  reference and rebuilds their rows (`rowOf`: the entry without `seriesStart`, and an occurrence the
  list dropped becomes an exdate). An id gone from one list is deleted only if its row is that
  list's, so moving between lists works in either order.
- `pullTasks`: single-flight; a call during a pull runs one more after it. Full replaces rows and
  lists; incremental upserts, then deletes; rows that aged out are pruned. Protection: ids with an
  outbox entry, or written locally within `IN_FLIGHT_MS` (15 s) before the pull started, keep their
  local row and entries; if the server sent one of them, the old cursor is kept (`held`) so the
  next pull, after the outbox drains, sends it again.
- `openTasks(userId)` resets everything for a new user, paints the stored rows, restores the queue
  and migrates the legacy localStorage copies once (removed only after IndexedDB holds them).

## Lists

- `upsertTaskWithRecurrence` replaces every entry with the task's id and re-expands it per loaded
  month (instances share the series id; the server expands only on GET). It expands from
  `seriesOf(task)`, so an instance is safe; a series date change must arrive as a shifted anchor.
- `revertTask(current, previous, id)`: a rollback that resets only `id` to its `previous` entries.
- `getTasksForDay` memoizes per tasks array and zone in a `WeakMap` and returns shared buckets:
  never mutate them or the tasks array; `setTasks` always gets a new array. A task whose
  `date + duration` crosses midnight lands in every day it covers (`spanDayKeys`), and so does
  `listDays`; `mergeMonth` (older months only) dedupes by `id-date` because the server also sends
  those that start in the month before.

## Copy and tests

- Helpers read pt-BR from `@/components/dashboard/copy`. The `.replace` in `repeat-label` (its
  value is a number; `fill` would be a cycle with `functions.ts`) and the api.ts fallback messages
  are legacy
  ([Copy](../../../../RULES.md#copy-and-i18n)).
- Harness and jsdom opt-in: `apps/web/CLAUDE.md`. A module that calls the API mocks `./api` through
  `vi.hoisted`, as `offline.test.ts` does.
