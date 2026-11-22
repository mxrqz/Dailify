# apps/server/migrations — D1 schema migrations

The schema of the `dailify` D1 database, one numbered file per change. Repo-wide rules: `/RULES.md`
("Backend and API"). Queries over these tables live in `src/db/`.

## How the files run

- Wrangler and vitest (`readD1Migrations` + `applyD1Migrations` in each suite's `beforeAll`) both
  replay every `*.sql` here in number order. Write
  plain SQLite with no `BEGIN`/`COMMIT`: D1 runs each file in its own transaction, and a failing
  file rolls back alone while the earlier ones stay applied.
- `bun run deploy` applies `--remote` and then runs `wrangler deploy`; `bun run dev` applies
  `--local` before `wrangler dev`. The Workers Builds deploy command must be `bun run deploy`: a
  bare `wrangler deploy` once shipped a worker writing `links` before 0002 ran remotely, and every
  save answered 500.
- Applied files are recorded by name in `d1_migrations` and never re-run. An edit to one never
  reaches prod and forks the local schema from the remote one, so fix forward in a new file.

## Adding a migration

1. From `apps/server`: `bunx wrangler d1 migrations create dailify <snake_name>`, which writes
   `NNNN_<snake_name>.sql`.
2. Replace wrangler's `-- Migration number` line with an English header giving the WHY and what NULL
   or the DEFAULT means for existing rows (`0016_mew.sql`, `0010_repeat_every.sql`).
3. Keep it additive: the old worker serves traffic against the new schema until the new one is live.
   A `NOT NULL` column needs a constant DEFAULT. A DROP/RENAME COLUMN or a table rebuild goes in a
   later migration, shipped once the worker that stopped using the column is live. DROP INDEX is
   safe in one step.
4. SQLite refuses DROP COLUMN on a column that is indexed (partial-index `WHERE` included), PK,
   UNIQUE or in a foreign key: drop the index first, in the same file.
5. A new table with `user_id` also goes into `deleteUserData` (`/RULES.md`, "Backend and API").
6. `bun run test` in `apps/server`: the suites replay the whole chain on a fresh D1.

## App-table conventions

- snake_case names. Instants are epoch-ms `INTEGER` (`<x>_at` for event times), booleans are
  `INTEGER NOT NULL DEFAULT 0`, zones are IANA `time_zone TEXT`, arrays are JSON `TEXT`. Never
  store a derived value (`hash` is computed in `src/db/tasks.ts`).
- Natural composite PKs where the key is natural (`usage`, `integration_links` plus its
  `UNIQUE (user_id, provider, external_id)`).
- Indexes are named `idx_<table>_<cols>`, partial for sparse columns (`idx_tasks_alert`, with
  `WHERE alert IS NOT NULL`), and added only with the query that needs them, checked with
  `EXPLAIN QUERY PLAN`: every index costs every write.
- Outliers, don't copy: `push_subscriptions.created`/`.timezone` and the index `mew_actions_user`
  (renaming them would break the running worker). The pt-BR headers in 0001-0015 stay as they are.

## Better Auth tables (0015)

- `"user"`, `session`, `account` and `verification` are Better Auth CLI output: quoted camelCase,
  ISO-text dates in `date` columns, in the exact shape the adapter reads. App tables never adopt
  that style. `magic_link_challenge` and `magic_link_sent` in the same file are app tables.
- To change them, run the command in the header of `scripts/auth-schema.ts` (it emits a full
  schema from `:memory:`, not a diff), diff the output against 0015 and hand-write the ALTERs in a
  new file.
- `0019_mcp_oauth.sql` adds the `jwt` and `@better-auth/mcp` tables the same way. Their owner
  column is `"userId"` with `ON DELETE CASCADE`, so they stay out of `deleteUserData`.
- `0021_two_factor.sql` adds `twoFactor` and `"user".twoFactorEnabled` the same way, plus the app
  table `session_mfa`, which cascades with `session`.
- `0022_passkey.sql` adds `passkey` the same way; it cascades with `"user"`.
- Never rebuild `"user"`: `session` and `account` reference it `ON DELETE CASCADE`, D1 enforces
  foreign keys, and `DROP TABLE` deletes the rows first, which signs everyone out and unlinks
  Google. `PRAGMA defer_foreign_keys` doesn't stop cascades.
