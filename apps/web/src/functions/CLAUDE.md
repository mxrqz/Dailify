# `src/functions/` — data layer & pure logic

Several very different files live here — keep them separate:

- **`functions.ts`** — PURE helpers (dates, task list ops). No I/O. Everything with real logic goes
  here so it can be unit-tested.
- **`api.ts`** — the impure I/O boundary: the thin fetch client for `apps/server` (tasks CRUD, month
  read, voice, permissions, billing). Not unit-tested (would need a live/mocked server).
- **`billing-sections.ts`** — pure helper deriving which billing sections (`subscription`,
  `invoices`) to render from `paymentDetails`/`invoices`, without a single all-or-nothing gate.
- **`functions.test.ts`** / **`billing-sections.test.ts`** — vitest for the pure helpers above.
  `bun run test`.

## The read/write split

`apps/server` (Hono/Workers + D1 + Clerk, same repo) serves everything now — tasks CRUD, the month
read (recurring already expanded server-side), billing, voice. Every call in `api.ts` takes a Clerk
JWT (`getToken()`) and hits `apiURL` (`VITE_API_URL`, `consts`). There is **no** direct Firestore
access anymore — `functions/firebase.ts` and the Clerk→Firebase custom-token bridge are gone
(migration phase 6).

## Dates: epoch-ms numbers, not `Date | Timestamp`

`TaskProps.date`/`alert`/`completed` (= shared `Task`) are plain **epoch-ms `number`s**. Writes that
mark completion push `Date.now()` (a number), not a `Date`.

**Never `new Date()` in app code — use `zone.ts`.** The app computes and shows dates in the account's
time zone (Settings; `null` = the device's), not the browser's. `zoned(ms?)` replaces `new Date(x)`,
`zonedAt(y, m, d, …)` replaces `new Date(y, m, d, …)`, `appTimeZone()` goes wherever a zone is sent
(`?tz=`, voice, push). They return a `TZDate`, and date-fns keeps the zone of a `TZDate` argument —
but a raw epoch passed to date-fns (`startOfMonth(task.date)`) falls back to the device zone, so wrap
it: `startOfMonth(zoned(task.date))`. `setAppTimeZone` is called by `dailifyContext`'s `setTimeZone`,
which also refetches the loaded months (their boundaries move with the zone).

## Parser — owned by `@dailify/shared`

`parseTaskText`/`parseLinks` (e o corpus golden, `bun run parser:failures`) moram em
`packages/shared` — importe de `@dailify/shared`. O fuso é explícito: passe `zoned()` (um `TZDate`
no fuso do app) como `now`; o parser não lê `appTimeZone()`.

## Recurrence — owned by `@dailify/shared`

`expandRecurringTask`/`normalizeRepeat` live in `@dailify/shared` now (used by `apps/server`'s
`GET /tasks`, which returns recurring instances already expanded and deduped). The web app doesn't
call them directly — `getTasksForMonth` (`api.ts`) just returns what the server sends.

## Conventions

- Pure logic → add it here with a vitest test (TDD: write the failing test first).
- No `as` assertions (use type guards); no hex (use tokens). See root `CLAUDE.md`.
