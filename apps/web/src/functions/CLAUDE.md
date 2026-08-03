# `src/functions/` — data layer & pure logic

Two very different files live here — keep them separate:

- **`functions.ts`** — PURE helpers (dates, task list ops). No I/O. Everything with real logic goes
  here so it can be unit-tested.
- **`api.ts`** — the impure I/O boundary: the thin fetch client for `apps/server` (tasks CRUD, month
  read, voice, permissions, billing). Not unit-tested (would need a live/mocked server).
- **`functions.test.ts`** — vitest for the pure helpers. `bun run test`.

## The read/write split

`apps/server` (Hono/Workers + D1 + Clerk, same repo) serves everything now — tasks CRUD, the month
read (recurring already expanded server-side), billing, voice. Every call in `api.ts` takes a Clerk
JWT (`getToken()`) and hits `apiURL` (`VITE_API_URL`, `consts`). There is **no** direct Firestore
access anymore — `functions/firebase.ts` and the Clerk→Firebase custom-token bridge are gone
(migration phase 6).

## Dates: epoch-ms numbers, not `Date | Timestamp`

`TaskProps.date`/`alert`/`completed` (= shared `Task`) are plain **epoch-ms `number`s**. Do date math
with `new Date(task.date)` directly — there is no `toJsDate()`/`Timestamp` union to normalize
anymore. Writes that mark completion push `Date.now()` (a number), not a `Date`.

## Recurrence — owned by `@dailify/shared`

`expandRecurringTask`/`normalizeRepeat` live in `@dailify/shared` now (used by `apps/server`'s
`GET /tasks`, which returns recurring instances already expanded and deduped). The web app doesn't
call them directly — `getTasksForMonth` (`api.ts`) just returns what the server sends.

## Conventions

- Pure logic → add it here with a vitest test (TDD: write the failing test first).
- No `as` assertions (use type guards); no hex (use tokens). See root `CLAUDE.md`.
