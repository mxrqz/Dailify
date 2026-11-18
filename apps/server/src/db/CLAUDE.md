# apps/server/src/db — D1 query layer

The Worker's SQL, hand-written over the raw `D1Database` binding (no ORM). Repo-wide rules:
[RULES.md](../../../../RULES.md), SQL under "Backend and API". Schema changes:
[migrations/CLAUDE.md](../../migrations/CLAUDE.md).

## Modules

- `tasks.ts`: `tasks` rows, `TaskRow` + `rowToTask` (reused by push.ts and calendar-sync.ts), JSON
  codecs, the LWW upsert, completions and occurrences, `USER_TABLES` + `deleteUserData`.
- `integrations.ts`: `integration_connections`, `oauth_states`, `integration_links` for the
  propagation and the web.
- `calendar-sync.ts`: Google-only sync (claim, sync token, import batch), provider hardcoded as `P`.
  Legacy split: `linkByExternal`/`instanceLinks`/`linkStatement` duplicate integrations.ts. Don't
  add a third copy.
- `push.ts`: subscriptions and the cron's cross-user alert queries. `settings.ts`: `user_settings`,
  defaults when no row. `usage.ts`: the `usage` counter, keyed `(user_id, quota, period)`.
- `limits.ts`: quota policy. `aiQuotaError`/`debitAi` take a Hono `Context` and return a `Response`,
  the one exception to "db never returns a Response"; slated for `lib/`, don't extend it.
- `mew.ts`: the `mew_actions` log, task ids only, never titles.

SQL still outside db/, to move here: `lib/user.ts` and `middleware/auth.ts` (`"user"`),
`auth-options.ts` (`magic_link_*`, `verification`).

## Conventions

- Signature `(db, userId, ...)`. Cross-user by design: push.ts's cron queries, `oldestSyncs`, and
  `oauth_states`, keyed by a random state (`insertState` sweeps everyone's expired rows).
- snake_case row interfaces stay in db/; exports return camelCase types via a mapper (`rowToTask`,
  `toLink`, `toSyncLink`) that narrows `provider` with `isProviderId` (`listTaskLinks`).
  `ConnectionRow` and `OAuthState` leak raw today; don't copy that.
- `*Statement` returns an unexecuted `D1PreparedStatement`. Each `db.batch` has a comment naming the
  half-written state it prevents (`detachOccurrence`, `importTask`).
- Claims are one `UPDATE|DELETE ... RETURNING` + `.first()`: `claimSync` is the 60 s throttle and
  the lock, `consumeState` succeeds once.
- `T | null` = missing, not owned or not applicable (`excludeOccurrence` on a non-series); `boolean`
  from `meta.changes > 0` = a row changed (`keepDuplicate`, `setActionStatus`).
- Booleans INTEGER 0/1 (`=== 1` out), instants epoch-ms, arrays JSON TEXT read through
  `safeParse`/`stringArray`/`numberArray`, so a corrupt row reads as empty instead of throwing.
- Ids containing `_` are prefix-matched with `substr(col, 1, ?)=?`: `_` is a LIKE wildcard.
- integrations, calendar-sync and mew take `now: number`; `saveSubscription` and `saveSettings`
  still call `Date.now()`.
- New names: verb first, `get*` one or null, `list*` many, `count*` a number. Outliers, renamed when
  touched: `getMonthTasks`/`getUndatedTasks` (many), `dueAlerts`.

## Invariants

- The `tasks` PK is global and ids come from the client, so ownership is the upsert's
  `WHERE tasks.user_id=excluded.user_id`. `insertTask` returning null = another account owns the id;
  `routes/tasks.ts` answers 409.
- `insertStatement` never writes `exdates`. `addExdatesStatement` merges dates in SQL (occurrences,
  merge); `setExdatesStatement` replaces the list, only for the import batch.
- `alert_sent` (not in `TaskRow`) = send time for one-offs, alert instant of the last notified
  occurrence for series. `updateTask` resets it to NULL when `alert` changes. Imported undated
  tasks get `alert_sent=alert`: their 09:00 alert is an anchor, not a push.
- `hash` is computed in `rowToTask`, never stored. `undated=1` makes `date` an anchor month reads
  skip. `repeat_every` NULL = 1. `everyCol`/`untilCol` null series-only fields when repeat is Off.
- `upsertConnection` with a new `account_id` drops that provider's links and `sync_token` in the
  same batch. A disconnect never deletes tasks.
- Instance links: external_id `${masterId}_<YYYYMMDDTHHMMSSZ>` (all-day `_<YYYYMMDD>`), built in
  `integrations/google-calendar/index.ts`.

LWW and list merges live in SQL: `updateTask` repeats `updated_at<=?` in its UPDATE,
`appendCompletion` keeps `MAX(updated_at, ?)`, completions and exdates merge through `json_each`.
Writes end in `RETURNING *` (or a SELECT in the same batch when a refused upsert returns no row,
`insertTask`), never a separate read. Known gap: `mergeDuplicate` still merges `links` in JS. Id
lists go in one
JSON param (`IN (SELECT value FROM json_each(?))`, `markAlertsSent`), never one `?` per id.

## D1 facts beyond RULES.md

- 1000 queries per invocation on Paid, 50 on Free; a whole `db.batch` counts as one. Per-statement
  limits (100 params, 100 KB SQL) still apply inside a batch.
- LIKE/GLOB patterns cap at 50 bytes. `RETURNING` and `ON CONFLICT ... DO UPDATE ... WHERE` work.

## Adding a table

1. Migration (migrations/CLAUDE.md), then a row interface and its mapper.
2. Verb-first `(db, userId, ...)` functions, `*Statement` builders for batched writes.
3. Its name in `USER_TABLES` (`deleteUserData`); `test/account-delete.test.ts` fails on any table
   with a `user_id` column that is missing there.
4. A test on the real D1 (`applyD1Migrations(env.DB, env.TEST_MIGRATIONS)` in `beforeAll`) for the
   epoch-ms/boolean shape and that another userId sees nothing. Existing: `db-tasks`, `db-usage`,
   `limits`, `alerts`; calendar-sync and mew via `integrations-sync` and `mew-chat`. Harness:
   [test/CLAUDE.md](../../test/CLAUDE.md).
