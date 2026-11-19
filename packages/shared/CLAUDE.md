# packages/shared — `@dailify/shared`, the model both apps import

Repo-wide rules: [`/RULES.md`](../../RULES.md). What may enter shared is in
[Where code goes](../../RULES.md#where-code-goes); isomorphism, registries and "numbers live once"
are in [Shared model](../../RULES.md#shared-model); required zones are in
[Dates and time zones](../../RULES.md#dates-and-time-zones). This file only adds what is local.

## How it is consumed

- No build: `exports["."]` is `src/index.ts`, a flat `export *` barrel. Three checkers compile the
  same source:
  - shared: TS 5.9, `lib: ["ESNext"]`, no DOM. `src/globals.d.ts` declares the only host APIs
    (`URL`, `console`). This is the only checker that catches both DOM and Workers leaks.
  - web: TS 5.9, ES2022 + DOM.
  - server: TS 7, ESNext + `@cloudflare/workers-types` (has `fetch`, `caches`, `crypto`).
- `*.gen.ts` are bun dev scripts excluded from tsc; they are the only place Node APIs may appear.
- One runtime dependency, `@date-fns/tz` (Intl only, runs on the Worker), for the parser.

## Module map (`src/`)

- `types.ts`: `Task`, `TaskInput` (PATCH: `null` resets, absent keeps), `OccurrenceEdit`, `Repeat`, `Role`, `PLAN_ID`,
  `ParsedTaskWire`, `AiIntent`/`AiParse`, Stripe `Invoice`/`PaymentDetails` (Unix seconds).
- `errors.ts`: `API_ERROR`, the `code` registry of every error the web reacts to, and
  `isApiErrorCode`.
- `mew.ts`: the Mew chat wire (`MewRequest`/`MewReply`/`MewBlock`) and the `MEW_*` caps, plus the
  `MEW_CONSENT_REQUIRED` error text older app builds compare.
- `integrations.ts`: `ProviderId`/`INTEGRATIONS`/`PROVIDER_IDS`, `CalendarTarget`,
  `IntegrationStatus`, `IntegrationLink`, `INTEGRATION_ERROR` (a slice of `API_ERROR`),
  `calendarSlot`, `matchDuplicate`, and `calendarEventPreview`, the web card and the server action
  preview alike. `MISSING_SCOPE_ERROR` is a legacy text kept for older app builds.
- `copy.ts`: the pt-BR text shared code renders (`sharedCopy`, `{placeholder}` + `fillShared`),
  not exported from the barrel. It is the file that gets an English pair (bd `Dailify-1xy`).
- `duration.ts`: the `Task.duration` format (`DEFAULT_DURATION`, `DURATION_RE`/`isDuration`,
  `durationMinutes`, `minutesToDuration`).
- `testing.ts` (`@dailify/shared/testing`): `makeTask(over)` for tests; pure, no vitest import.
- `limits.ts`: `TASK_LIMITS` (content caps, `repeatEveryMax`, `priorityMax`), `DATE_RANGE`.
  `pricing.ts`: `PLAN_PRICING` in cents, `formatPrice`.
- `quotas.ts`: `QUOTAS` per `Role`. Only `ai` has a limit (`tasks` is `-1` for every plan).
  `QuotaSnapshot` (`GET /permissions`) and `QUOTA_ERRORS`, the exhausted-quota error texts.
- `timezone.ts`: `zonedParts`/`zonedEpoch` (two-pass DST fix, one cached formatter per zone),
  `isTimeZone`, and civil-date helpers `isoDate`, `isoWallTime`, `civilDay`, `weekdayOf`.
- `dates.ts`: `monthKey`/`parseMonthKey` ("YYYY-MM", the `?month=` and `usage.period` format),
  `startOfMonthMs`/`endOfMonthMs`, legacy optional zone (tested in `timezone.test.ts`).
- `guards.ts`: `isRecord`, `isStringArray` for untrusted JSON.
- `period.ts`: `WeekStart`, `UserSettings` (`/settings`), the 06:00 rollover, `periodStart`,
  `doneThisPeriod`.
- `recurrence.ts`: `expandRecurringTask`, `seriesOf` (instance back to its stored series),
  `seriesEvery`, `isRepeatEvery`, `normalizeRepeat`, `weekDays`/`dayMap`. `rrule.ts`:
  `toRrule`/`fromRrule` for Google Calendar.
- `hash.ts`: `taskHash`, `stampUpdatedAt` (LWW clock-skew clamp). Server-only today.
- `compose-input.ts`: `composeTaskInput`, `undatedReminder`, `fromWire` (AI draft to a parse),
  `DEFAULT_HOUR`. The web composer and the server voice/AI path (`draftToTask`) both turn a parse
  into a Task here.
- `parse-links.ts` (also `videoLink`/`meetLink`/`isCalendarEventLink`), `parse-task/`: the rule-based pt/en parser, see
  [`src/parse-task/CLAUDE.md`](src/parse-task/CLAUDE.md). Its golden corpus sits at the `src/`
  root: `parse-task.corpus.ts`, `parse-task.corpus/`, `parse-task.known-failures{,.gen}.ts`.
- `reminders.ts`: `Reminder`/`ReminderFeed`/`ReminderToken`, the Android reminder feed wire
  (the Kotlin plugin in `apps/web/src-tauri/plugins/reminders` reads the same JSON).
- `app-url.ts`: `APP_HOST`/`APP_URL`. Domain change steps are in the root `CLAUDE.md`.

## Recurrence (bites if ignored)

- `expandRecurringTask` never returns the stored occurrence. Callers add it: `[task, ...expanded]`
  in `apps/server/src/lib/occurrence-alert.ts` and `upsertTaskWithRecurrence` in
  `apps/web/src/functions/functions.ts` (the web re-expands after an edit); `readMonth` in
  `apps/server/src/db/tasks.ts` gets it from the month's stored rows.
- It drops `exdates` and dates after `repeatUntil`; instances carry `seriesStart` = the anchor.
- `repeatEvery` counts civil days/months/years from `task.date`, so DST never moves the phase.
  Weekly every N = 7-day blocks from the task's own day, not from `weekStart`. Monthly/yearly on the
  29th-31st clamp to the month's last day without moving the anchor.
- `month: Date` only carries year and month, read with `getFullYear`/`getMonth`: in its own zone
  for a `TZDate` (the web passes zoned months), else in the runtime zone (on the Worker, UTC
  `new Date(y, m, 1)`). The optional `timeZone` is legacy against RULES.md "Dates and time zones":
  missing means the runtime zone.
- Change `rrule.ts` with the expansion: `WKST` = the start weekday when `INTERVAL>1`,
  `BYMONTHDAY=28..N;BYSETPOS=-1` is the clamp, `COUNT` becomes `UNTIL`, and anything the model
  can't express returns `null`. `rrule.test.ts` round-trips each series shape.
- Server zone sources: `GET /tasks?tz=` (optional, so UTC without it); a body `timezone` on parse,
  voice and Mew (audio voice falls back to `user_settings.time_zone`); alerts use
  `user_settings.time_zone`, then `push_subscriptions.timezone`, then UTC (`db/push.ts`).

## How to add

- **A Task field:** declare it in `types.ts` with its unit, and say so in its doc when only the
  server writes it or it is derived (as `exdates`, `repeatUntil`, `seriesStart`, `hash` do). Decide
  its `TaskInput` shape: omit it (`hash`) or redeclare it (`repeatEvery: number | null`). If it is
  content, append it to `taskHash` only when non-default, like `repeatEvery`, or every stored hash
  changes; `updateTask` skips the write on equal hashes. Then on the server: `lib/task-input.ts`
  (`parseTaskFields`), `db/tasks.ts` (`rowToTask`, `insertStatement`, `updateTask`), a migration.
- **A quota:** an entry in `QUOTAS` with a limit per `Role` (`-1` unlimited, `0` blocked). The
  server's `COUNTERS` (`db/limits.ts`), `QUOTA_ERRORS` (here) and the web labels (`dashboard/copy.ts`,
  `pricing/copy.ts`) are keyed by `QuotaKey`, so tsc lists every place. A `0` limit also needs a
  per-quota loading default in `computeQuotas` (see its `ponytail:`).
- **A provider:** a `ProviderId` member plus its `INTEGRATIONS` entry, then a module in
  `apps/server/src/integrations/` registered in `registry.ts`; the provider contract in
  `apps/server/test/integrations.test.ts` covers it.

## Tests

- Colocated `*.test.ts` (12 suites), run with `bun run test` here. Each pins its zone (`sp()` TZDate
  in `parse-task.test.ts`, `CORPUS_ZONE` in `parse-task.corpus/kit.ts`) and passes under
  `TZ=Pacific/Auckland`; never use `new Date(y, m, d)` in a zone-sensitive expectation.
- After a parser change, run `bun run parser:failures`: it regenerates the known-failures ratchet
  and prints `REGRESSÃO` for each new failure.
