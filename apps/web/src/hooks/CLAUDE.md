# apps/web/src/hooks — cross-feature hooks and app-wide stores

Repo-wide rules: `/RULES.md` ("Where code goes" for placement; "Frontend" for the settle contract,
functional updates, series anchors and effect deps). Test harness: `apps/web/CLAUDE.md`.

## What lives here

- Task writes: `useTaskActions.tsx` (dated), `useUndatedActions.ts` (undated), `useCreateTask.ts`
  (+ `useShowCreated`), `useCalendarPush.ts` (+ `useApplyTask`, `calendarRevoked`). The rest are
  module stores, platform wrappers and `useQuotas` (sections below).
- `useMewParse` and `useVoiceCreate` serve only the dashboard composer and FAB; they predate the
  placement rule. One-feature hooks sit beside their component: `useCalendarChip`
  (`dashboard/calendar-chip.tsx`), `useWeek` (`dashboard/week-strip.tsx`), `useMewApply`
  (`mew-chat/apply.ts`), `useUndatedOpen` (`dashboard/undated-column.tsx`).

## Write contract details

- Settle: no error keeps the optimistic state; `shouldQueue(error)` (`functions/offline.ts`: offline
  or 401) with a userId calls `enqueue(userId, mutation)` and keeps it (a 401 is a dead session, not
  a refused edit); anything else rolls back and shows
  `toast.error(copy.task.*Error, { description: error.message })`. Model: `run` in
  `useUndatedActions.ts`. Every settle, `edit-task.tsx` and `drainQueue` included, calls
  `shouldQueue`; never re-spell the predicate.
- Writes a caller reacts to return `Promise<boolean>` = the write stands (on the server or queued).
- Take `at = Date.now()` once per action and reuse it as `updatedAt` in the optimistic state, the
  request and the `Mutation` (server LWW, also on a late replay). Ids come from `newTaskId()`, so a
  queued create replays without duplicating. A write that must survive offline needs a `Mutation`
  variant and a `send` case in `functions/offline.ts`.

## useTaskActions(task, day, { onDeleted })

- Returns `onComplete` (stamps now on today's card, `task.date` on another day's, since completion
  is read per day; `updatedAt` stays now), `onUncomplete` (only `day`'s window), `onPatch(patch, occurrence?)`,
  `onRename`, `onDelete`, `deleteDialog`. Each caller renders `deleteDialog` once (hence `.tsx`).
- `onDelete`: recurring asks occurrence vs series first; Calendar-linked (`isCalendarEventLink`)
  confirms in an ActionSheet, no Undo (the Google event goes too); a plain delete is immediate with
  a 6 s "Desfazer" that re-creates the same id. "Only this one" sends `?occurrence=`, the date joins
  the series' `exdates`; no route removes an exdate, so it is sent only when its 6 s toast closes
  (`onAutoClose`/`onDismiss`) and its Undo just puts the instance back.
- `useCreateTask` marks the optimistic object (`isSaving`, a WeakSet) until the server's copy, or a
  fresh one on queueing, replaces it; the agenda row reads "Salvando…" meanwhile.
- `onPatch`: `repeatEvery: null` on the wire is back to 1 (locally `undefined`). Apply the reply's
  `series` before `updated`: re-expanding it drops the occurrence that became its own task.
- A series-scope `onPatch` with a `date` shifts the anchor (`seriesOf(task).date + new - task.date`);
  Undo of a series delete re-creates `seriesOf(task)` without completions (the server drops them).
- Writes use functional updates; a rollback is `revertTask(cur, previous, id)`
  (`functions/revert-task.ts`), never `setTasks(previous)`.

## Other writers

- `useUndatedActions(task)`: `done`/`toggle`/`remove`/`schedule` on `upsertUndated`/`removeUndated`.
  A series is done per period (`doneThisPeriod`); reopening clears `periodStart(...)` to now
  (`uncomplete` with `until`). Only a one-off completion gets Undo, since it leaves the list.
  `schedule(at)` moves it to the agenda with `date = alert = at`.
- `useCreateTask().create` is optimistic and queueable; `createMany` (Mew drafts) is online-only,
  sequential, stops at the first failure and returns `true` if any landed (a retry would duplicate).
  `useShowCreated` shows tasks the server already created, bumps usage per task; Undo deletes them,
  queueing offline ones and putting refused ones back with `copy.task.deleteError`.
- `useCalendarPush` runs after the task exists: a failure never undoes it, one toast retries the
  failed ones. A 409 `INTEGRATION_ERROR.reconnect` anywhere goes through `calendarRevoked`.

## Stores and wrappers

- `useNow(60_000 | "day")`: one interval for the app (first subscriber starts it, last clears it),
  values from `zoned()`. `"day"` is the start of the day and changes identity only at midnight.
  Never disable it under reduced motion: the now line's position is data.
- `useIntegrations`: `undefined` until read; fetches only when nothing is cached or in flight and
  online (`useOnline`, so reconnecting retries), a failure retries on the next mount. Writers: `setIntegrations`/`patchIntegration`. One provider:
  `useIntegration(id)`; `isActive(status)` = connected and `status === "active"`.
- `useOnline` lies upward (connected, no internet): use it to warn; `error.offline` decides.
- `useEffectEvent` polyfills React 19.2's hook; the lint knows the name, so call it only in effects.
- `useMediaQuery`: pass a named constant from `consts/media.ts` (`DESKTOP`, `MOBILE`,
  `SHEET_EDITING`, `NO_DRAG`) and read it once per list.
- `useStoredFlag(key)`: device-wide `"1"`/`"0"` under `dailify:<name>`, so not in `clearLocal`;
  `useCalendarDefault` is one. `useCalendarReady` = Google Calendar connected and active.

## Quotas and AI

- `useQuotas` is cosmetic; the server enforces. While quotas load everything counts as unlimited,
  so nothing blocks. `bumpUsage` runs only after the server accepted.
- Status codes: create 429; AI 403 = plan without AI (on `/mew/chat` also no consent), 429 =
  exhausted. Offer `/premium` only on these. Out of AI credits, call `setCreditsTray(true)`
  (`useCreditsTray.ts`), never a toast: `components/credits-tray.tsx` (mounted in AppLayout) is
  the one upgrade prompt.
  `useMewParse` keeps a local `refused` flag because the 429 lands before quotas reload.
- `useVoiceCreate`: the 60 s `MAX_RECORDING_MS` is a courtesy (the server 413s over 512 KB); the
  `starting` ref blocks a second mic mid-prompt. Re-check cancel after every await: `start` resets
  `discard` before `getUserMedia` and drops the stream if a cancel landed during the prompt.

## Tests

- Render tests run the real hooks through components with `@/functions/api`, `@/lib/auth` and
  `useDailify` mocked; only `dashboard/create-fab.render.test.tsx` mocks a write hook.
- Queue and rollback branches need a direct `renderHook` test. Reference: the `useUndatedActions`
  block in `dashboard/anytime-block.render.test.tsx` (real `offline.ts`, asserted with
  `readQueue("u1")`; render `<Toaster />` to click Undo). `useTaskActions.render.test.tsx` mocks
  `setTasks` as a stateful setter, so a functional update reads the list of the moment.
- `useNow.render.test.tsx` pins the single interval and the midnight-only `"day"` render.
