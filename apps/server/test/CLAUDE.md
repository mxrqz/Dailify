# apps/server/test — server test suite

Repo-wide rules: `/RULES.md` ("Testing", "Backend and API"). Route checklist: `src/routes/CLAUDE.md`.
`@cloudflare/vitest-pool-workers` runs each file inside workerd against a real D1, with the
`wrangler.toml` bindings (`configPath`) plus the fakes in `vitest.config.ts`. `test/` is in the
server's prettier, eslint and `tsc` gates. Its package-rename warning on every run is expected.

## Layout

- `<area>-<feature>.test.ts`, flat (`tasks-edit`, `integrations-sync`, `db-tasks`). Route describes
  read `"METHOD /path — facet"`; unit describes use the function or `db/<module>` name.
- `session.ts`: the replacement for `../src/auth` (`mockSession`, `seedUser`).
- `fixtures/<provider>/index.ts`: real responses reduced to the fields the server reads.
- `env.d.ts`: adds `TEST_MIGRATIONS` and the optional `LIVE_*` bindings to `Cloudflare.Env`.

## Invariants that bite

- Storage is isolated per file, not per test, and the `[[ratelimits]]` bindings really run (API 120,
  VOICE 6, AUTH 5 per minute per key). Give each test its own user id
  (`` `eu-${crypto.randomUUID()}` `` in beforeEach) or filter assertions to its own ids. One id that
  makes more than 6 OpenAI-route calls in a file gets a 429 (`mew-chat.test.ts` switches ids for this).
- Each D1 file applies migrations itself: `beforeAll` + `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`.
- Call the app with `app.request(path, init, env, ctx)`. Hono's `c.executionCtx` throws without a
  ctx, so `GET /tasks` (sync) and a linked PATCH/DELETE (propagate) need `createExecutionContext()`.
  A test that asserts that background work awaits `waitOnExecutionContext(ctx)` first (`send` in
  `integrations-propagate.test.ts`).
- Wrangler loads `apps/server/.env` as secrets ("Using secrets defined in .env"). Every secret the
  code reads needs a fake binding in `vitest.config.ts`; `OPENAI_API_KEY` has none, so an unmocked
  OpenAI path calls the real API. `pricing-stripe.test.ts` hits live Stripe when `.env` holds an
  `sk_` key and all four price ids (the `LIVE_*` bindings), and skips otherwise.
- workerd runs in UTC: `new Date(y, m, d)` is a UTC instant. Pass `?tz=`/`timezone` when the test is
  about the user's local day.
- New files import `env` from `cloudflare:workers` (`session.ts`); the `cloudflare:test` export is
  deprecated. Take only `applyD1Migrations`, `createExecutionContext` and `waitOnExecutionContext`
  from `cloudflare:test`.

## Mocking

- Auth: `vi.mock("../src/auth", () => import("./session"))` + `mockSession(() => ({ id, plan }))`,
  read on every request (`null` = 401). With `plan` it seeds the `"user"` row first, because
  `requireAuth` reads the plan from D1; `seedUser` covers `stripeCustomerId`. `magic-link` and
  `account-delete` use the real Better Auth via `auth.api.*` (captcha runs only in the HTTP handler).
- `stripe`, `openai` and `../src/lib/email` are module mocks; the Stripe and OpenAI ones are copied
  per file today (`checkout.test.ts`, `voice.test.ts`).
- Google goes through `vi.spyOn(globalThis, "fetch")`, set in beforeEach, restored in afterEach, and
  throwing on any URL it doesn't know (`integrations-propagate.test.ts`).
- Legacy: `integrations-sync.test.ts` mocks shared `matchDuplicate` with a stale reason ("arrives in
  Phase 1B"); the real matcher exists and takes a `timeZone`.

## Adding a test file

1. Start from the closest sibling: `tasks-edit.test.ts` (route, one session), `db-tasks.test.ts`
   (queries), `integrations-propagate.test.ts` (fresh id per test, fetch router, `send`). Mocks go
   first, migrations in `beforeAll`.
2. A new third-party API gets `fixtures/<provider>/` and a throwing fetch router.
3. `bun run test test/<file>` from `apps/server`, then `bun run format`.
