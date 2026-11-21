# apps/server/src/routes — HTTP routes

Repo-wide rules: [/RULES.md](../../../../RULES.md) ("Backend and API": `fail` + `code`, identity,
limiter order, `waitUntil`, AI credit order). Routes validate and wire; SQL lives in `db/`, SDK and
provider work in `lib/` and `integrations/`.

## Inventory (mounted in `../index.ts`)

- `tasks.ts` at `/tasks`: `GET /?month=YYYY-MM&tz=`, `GET /undated`, `POST /`, `PATCH|DELETE /:id`
  (`?occurrence=<epoch-ms>` = one instance), `POST|DELETE /:id/complete`.
- `voice.ts`, also at `/tasks`: `POST /parse` (text), `POST /voice` (multipart audio).
- `mew.ts` at `/mew`: `POST /chat` (`permission: { id, always }` = the re-sent turn after a
  permission box: claims the pending read, no quota check and no debit, since its first reply was
  the turn's credit), `PATCH /actions/:id`, `POST /actions/:id/send` (a confirmed send box).
- `billing.ts` at `/`: `GET /permissions`, `/billing/{checkout,portal,payment-details,invoices}`,
  `POST /webhooks/stripe` (public, signature-checked, empty 200).
- `push.ts` at `/`: `GET /push/key` (public), `GET|POST|DELETE /push/subscription`.
- `settings.ts` at `/`: `GET|PUT /settings`.
- `reminders.ts` at `/reminders`: `POST /token` (session) mints the Android app's read-only feed
  token; `GET /feed?tz=` (that token as Bearer, `feedAuth`) returns the next 14 days of alerts.
- `mcp.ts` at `/mcp`: `POST /` (MCP access token, `API_LIMITER`), one JSON-RPC message per call,
  dispatched by `lib/mcp.ts`; `GET|DELETE` answer 405. Its tools write through
  `tasks.request(path, init, c.env, c.executionCtx)` with the same token (`requireTaskAuth`), so
  each write counts twice against `API_LIMITER`.
- `integrations.ts` at `/`: `GET /integrations`, `POST /:provider/{connect,callback}`,
  `DELETE /:provider`, `DELETE /:provider/grants/read` (the Mew's "always read" switch),
  `POST google-calendar/{events,events/:taskId/meet|sync,duplicates/:id}`.

## A new module

```ts
const things = new Hono<AppEnv>();
things.use("*", requireAuth);
things.use("*", rateLimit("API_LIMITER")); // only if every route shares it, else per route (mew.ts)
// index.ts: app.route("/things", things);
```

- Canonical: `tasks.ts:26-28`. Mount once at its own prefix: never `/`, never a taken prefix.
- Only `/health`, `/auth/*` and `/.well-known/*` (index.ts), `/push/key`, `/webhooks/stripe`,
  `/reminders/feed` and `/mcp` (their own tokens) skip `requireAuth`. A
  new public endpoint goes above the `use("*")` or in its own module.
- Legacy, don't copy: modules at `/` with path-scoped auth (billing, push, settings, integrations).
- A new authenticated route gets a row in `AUTHENTICATED` (`test/auth.test.ts`).

## Hono gotchas (verified on 4.13.18)

- Sub-apps at the same prefix share middleware: tasks' `use("*")` would also run for `/tasks/parse`
  and `/tasks/voice`. That is why index.ts mounts voice before tasks; keep that order.
- `use("/x/*")` also matches `/x`. Register `/x/*` only.
- Middleware and handlers run in registration order; the first to return without `next()` wins.

## Limiters (`wrangler.toml`)

- `API_LIMITER` 120/min per user: D1 and Stripe. `AI_LIMITER` 6/min per user: every OpenAI
  route (`/tasks/parse`, `/tasks/voice`, `/mew/chat`). `AUTH_LIMITER` 5/min per
  `cf-connecting-ip`: before login only.
- Tests run the real bindings (`test/CLAUDE.md`); only `tasks-parse.test.ts` asserts a limiter's
  429 (`AI_LIMITER`), and a missing binding is a no-op: a forgotten `rateLimit(...)` passes the
  gate. `auth.test.ts` asserts that `POST /tasks/parse` and `GET /integrations` read the session
  once.

## Bodies

- Read with `readJson(c)` (`lib/task-input.ts`) and narrow with `isRecord` (`@dailify/shared`). A bare `c.req.json()`
  turns malformed JSON (or a destructured `null`) into a 500 via `app.onError`.
- A parser whose errors aren't all 400 carries `status` in its union (`parseRequest`, mew.ts).
- Zones: `validZone`; new endpoints take the body key `timezone`. Months: `parseMonth`; epochs:
  `isEpochMs`, `parseOccurrence` (all `lib/task-input.ts`). Caps: `TASK_LIMITS`, `DATE_RANGE`, `MEW_*` from `@dailify/shared`.
- Partial writes: absent key keeps, `null` clears, no known key is a 400 (`parseTaskFields` with
  `partial: true`, `parsePatch` in settings.ts).
- Multipart (voice.ts): `parseBody()`, `instanceof File`, 413 size cap, 415 MIME, before paying.

## Status codes

- 400 invalid input · 401 no session · 403 plan gate, AI blocked on the plan, Mew consent, OAuth
  state of another user · 404 unknown or not owned · 409 conflict (`id already in use`) or
  `API_ERROR.reconnect` · 413/415 payload · 429 rate limit or quota · 502 upstream failure
  (no AI debit) · 503 optional feature not configured. A 500 comes only from `app.onError`.
- Codes (`API_ERROR`, shared) ride beside the old texts, which older app builds still compare:
  `rate_limited` (`rateLimit`), `ai_blocked`/`ai_exhausted` (`aiQuota`, `db/limits.ts`),
  `mew_consent_required`, `missing_scope`, `reconnect`, `already_linked`. A new branch the web
  reacts to adds a code there.
- Success: `c.json({ <noun>: ... })` (`{ task }`, `{ tasks }`, `{ series }`, `{ url }`) or
  `c.body(null, 204)`. Bare bodies (settings, integrations list, invoices, `AiParse`, `MewReply`)
  are legacy.
- `DELETE /tasks/:id` is 204 even when the row is gone (the offline queue replays it) or when its
  optional `?updatedAt=` is older than the stored edit (LWW: the row stays); a `PATCH` of a
  missing task is 404.
- The web (`request()` in `apps/web/src/functions/api.ts`) shows `error` as the toast description
  and branches on `status` + `code`; a non-JSON body degrades to "O servidor falhou (N).".
- Expected `integrations/` failures are typed errors mapped at the edge: `withCalendar` maps
  `ActionError` and `InvalidGrantError` and rethrows the rest.

## Adding a route

1. In the module that owns the prefix. A pure `parseX` beside the route, or in `lib/` once two
   routes share it, with a colocated test.
2. Test file `apps/server/test/<area>-<feature>.test.ts` (harness: `test/session.ts`, `mockSession`,
   `app.request(path, init, env, createExecutionContext())`; the context is required once the route
   calls `waitUntil`). Cover the happy path, the 400s, the tier gate and the epoch-ms shape; the 401
   is the `AUTHENTICATED` row in `test/auth.test.ts`.
3. A response richer than `{ <noun>: <shared model> }` gets a type in `@dailify/shared`, built with
   `satisfies`; then wire the client in `apps/web/src/functions/api.ts`.
