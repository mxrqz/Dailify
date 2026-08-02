# `src/functions/` — data layer & pure logic

Two very different files live here — keep them separate:

- **`functions.ts`** — PURE helpers (dates, recurrence, task list ops). No I/O. The only Firebase
  import allowed is the `Timestamp` _type_. Everything with real logic goes here so it can be unit-tested.
- **`firebase.ts`** — the impure I/O boundary: Firestore access + the HTTP client to the external
  server. Not unit-tested (would need the Firestore emulator).
- **`functions.test.ts`** — vitest for the pure helpers. `bun run test`.

## The read/write split (most important thing here)

There is **no backend in this repo** — the real backend is a separate repo (`dailify-server` on
Render, `serverURL` in `consts`). It writes with the Firebase Admin SDK, which **bypasses Firestore
rules**.

- **Writes** — create / edit / complete / voice / checkout / billing → `fetch(serverURL + …)` with a
  Clerk JWT (`saveTask`, `saveEditedTask`, `markTaskAsCompleted`, `createTaskVoice`). **Never** add a
  client-side `setDoc`/`updateDoc` to create or edit tasks.
- **Reads + delete** — go client → Firestore directly (`getDocs`, `deleteDoc`). These are the paths
  `firestore.rules` must protect (per-user isolation: `request.auth.uid == uid`). `userId` in the path
  is the Clerk id supplied by the client, so the rule is the only thing stopping cross-user access.

## Dates: never trust the type blindly

`TaskProps.date`/`alert`/`completed` are `Date | Timestamp` (fetched = `Timestamp`, optimistic =
`Date`). Always normalize with the local `toJsDate()` before any date op. Do **not** call `.toDate()`
unguarded — it throws on a plain `Date`.

## Recurrence — `expandRecurringTask(task, month)`

Builds instances **in the viewed month** (not the task's original month) and returns JS `Date`s.
The stored doc already covers the creation-month original (via `getMonthTasks`), so expansion skips it:
Daily/Weekly skip the original day; Monthly/Yearly skip the whole creation month; overflow days are
clamped; nothing is emitted before the task existed. Weekly matches weekday **names** (`weekDays`
index). If you touch this, keep the tests green — this was rewritten because the old version was
invisible outside the creation month (`pz9.2`).

## Firestore gotchas

- `where("id", "in", chunk)` caps at **30** ids → `getMonthTaskByIds` chunks. Don't reintroduce a
  full-collection read + client-side filter.
- `getTasksForMonth` = `getMonthTasks` (date range) + `getMonthlyRepeatTasks` (expanded recurring),
  deduped by `` `${id}-${date}` ``.

## Conventions

- Pure logic → add it here with a vitest test (TDD: write the failing test first).
- No `as` assertions (use type guards); no hex (use tokens). See root `CLAUDE.md`.
