# apps/server/src/integrations/google-calendar — Google Calendar provider

Task <-> event on the user's primary calendar: the push (insert, PATCH, DELETE, Meet) and the pull
sync. Repo-wide rules: `/RULES.md`. The generic provider contract (`PROVIDERS`, `ctx.api`, sealed
tokens, `propagate`) is in `../CLAUDE.md`.

## Layout

- `index.ts`: the `googleCalendar` `Provider` (OAuth config, `identify` via userinfo), the
  `createEvent` action, `onTaskChanged` = `syncEvent` (PATCH/DELETE), `replaceMeet`, `linkInstance`.
- `event.ts`: `eventId`, `toEvent` (Task -> insert body, `null` when the task has no day), the Meet
  `Conference` builders.
- `sync.ts`: `syncCalendar` (Google -> D1), `syncIfDue` (the `GET /tasks` `waitUntil`),
  `syncOldest` (the cron). Its SQL is in `db/calendar-sync.ts`.
- `routes/integrations.ts` calls `createEvent` and `replaceMeet` directly through `withCalendar`
  (plan gate, connection, `ActionError`/`InvalidGrantError` -> `fail`).
- `api.ts`: `EVENTS_API`, `field`/`text`, `json(method, body)` and `updatedOf`, shared by `index.ts`
  and `sync.ts`. The link cap is `appendLinks` in `../links.ts`.
- Errors: route-facing actions throw `ActionError` (`ensureOk`); `syncEvent` and sync throw a plain
  `Error`, which their callers catch on purpose.

## Push (Mewki -> Google)

- Event id = `eventId(taskId)`, base32hex (the only alphabet Google accepts). A retried insert gets
  409 and becomes a PATCH with `status: "confirmed"` (`saveEvent`): idempotent, and it revives a
  trashed event. `externalId !== eventId(taskId)` means a foreign event (imported or merged
  duplicate) or a series instance.
- `patchFor` sends only changed keys. Mewki-created events get the whole body; foreign ones only
  `FOREIGN_KEYS` (summary/start/end/recurrence/conferenceData); instances never get `recurrence`;
  a forced resend (`before = null`) never touches `conferenceData`, since rewriting it drops dial-in
  numbers and Zoom rooms.
- Readonly invites (organizer not self and `guestsCanModify` not true) never get a PATCH, and
  `replaceMeet` answers 400. Deleting the task still sends DELETE.
- PATCH merges objects: `start`/`end` spread `CLEAR_WHEN` (null `date`/`dateTime`/`timeZone`), or
  switching all-day <-> timed keeps both. A body with `conferenceData` needs
  `?conferenceDataVersion=1` (`conferenceQuery`), or Google ignores it.
- Every write stores the response `updated` as `remote_updated`; sync uses it to skip its own echo.
- 404/410 on PATCH/DELETE returns `"unlink"`. The `htmlLink` in `task.links` is what the web reads
  as "already linked" (`isCalendarEventLink`, shared), so unlinking also removes that URL from the
  task (`pushLink` in `../propagate.ts`, `cancel` in `sync.ts`).
- "Edit only this one" on a linked series: `linkInstance` links the detached task to instance
  `${master}_<UTC start>` (all-day: `_<yyyymmdd>` in the link's zone), and
  `withoutLinkedInstances` drops those dates from the series EXDATE, which would delete the override.

## Sync (Google -> Mewki)

- `claimSync` (`UPDATE ... RETURNING` on `synced_at`) is both throttle and lock: one pass per 60 s
  per active connection. `full: true` (only tests pass it) bypasses both.
- No token, or 410: full list from `now - 30 days`; otherwise incremental by `syncToken`. Lists use
  `singleEvents=false` + `showDeleted=true`; masters are applied before their exceptions.
- Cap: `MAX_PAGES` 10 x 250 events. Past it there is no `nextSyncToken`, so every pass is full.
- Last-write-wins (`update`): `ev.updated <= remoteUpdated` is our own echo; a task `updatedAt`
  at or after `ev.updated` keeps Mewki's version and marks the link `stale`; else Google applies.
  Readonly invites: Google always wins.
- Google owns title (capped at `TASK_LIMITS.titleMax` in `toFields`), date, duration, recurrence
  and the Meet link; the alert shifts with the start;
  priority, tags and completions stay Mewki's.
- All-day events become `undated` tasks anchored at 09:00 in the event zone (its valid
  `start.timeZone`, else the settings zone, else UTC). Multi-day, recurring all-day and RRULEs
  `fromRrule` can't express are skipped and counted in `skipped` (full sets it, incremental adds).
- Ignored: non-`default` `eventType` (out of office, focus, Gmail), declined invites, and events
  that ended before the 30-day cutoff. A cancelled instance adds an EXDATE to its master; a
  cancelled Mewki event is unlinked; a cancelled foreign event deletes its tasks.
- A lost link (account switch, restored D1) is rebuilt from
  `extendedProperties.private.mewkiTaskId`.

## OAuth and errors

- Scope `calendar.events.owned` (+ `openid email`): sensitive but verified without a CASA audit
  (bd `Dailify-zpq`). Don't widen it. `access_type=offline` + `prompt=consent` are what make a
  reconnect return a refresh_token.
- `ActionError` messages here are pt-BR because `components/add-to-calendar.tsx` (web) toasts
  `error.message`. Legacy against RULES.md "Backend and API": a new error gets a `code`.

## Adding a synced field

1. `GoogleEvent` + `toEvent` (event.ts), and `patchBody` with `null` when the value goes away.
2. Decide whether it belongs in `FOREIGN_KEYS` (never for text the event owner wrote).
3. If Google may change it: `Remote`/`read` and `toFields`/`update` in sync.ts.

## Tests

- `test/integrations-events.test.ts` (`toEvent`, create, duplicates, disconnect),
  `integrations-propagate.test.ts` (PATCH/DELETE, instances, Meet), `integrations-sync.test.ts`.
- Google is a `vi.spyOn(globalThis, "fetch")` over `test/fixtures/google-calendar/` (real
  responses trimmed to what the server reads); add a fixture there, not inline JSON.
- Slot and RRULE mapping (`calendarSlot`, `toRrule`, `fromRrule`) are tested in `packages/shared`.
