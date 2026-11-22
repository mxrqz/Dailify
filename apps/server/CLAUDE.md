# apps/server — Hono API on Cloudflare Workers + D1

The only writer of app data: the web and the Tauri app reach D1, Stripe and OpenAI only through
here, with a Better Auth session. Deployed as the Worker `dailify-server` (api.mewki.mxrqz.com).
Repo-wide rules: `/RULES.md` ("Backend and API" above all). This file holds the cross-cutting
server invariants; each folder below has its own `CLAUDE.md` for the rest.

## Layout

- `src/index.ts`: `Env` (bindings + secrets), `AppEnv` and the app. Order: CORS (its `origin`
  callback is `isAllowedOrigin`: `ALLOWED_ORIGIN` plus `NATIVE_ORIGINS`), public `/health`,
  `AUTH_LIMITER` on `/auth/sign-in/*`, `/auth/magic-link/*`, `/auth/one-time-token/*` and
  `/auth/oauth2/register`, Better
  Auth on `/auth/*` and `GET /.well-known/*`, `/mcp`, the other route modules (voice before tasks:
  see `src/routes/CLAUDE.md`), `app.notFound` and `app.onError` ->
  `fail(c, 500, "Internal error")`. The default export is the app with `scheduled`
  attached, so tests keep `app.request()`.
- `src/routes/` HTTP validation and wiring · `src/middleware/` `requireAuth`, `rateLimit` ·
  `src/db/` D1 queries · `src/lib/` services (AI, Stripe, push, e-mail, origins, input parsing) ·
  `src/integrations/` OAuth providers, propagation, Calendar sync · `src/alerts.ts` the alert cron.
- `src/auth-options.ts` + `src/auth.ts`: Better Auth (below). `src/env.d.ts` mirrors `Env` onto the
  `cloudflare:workers` env.
- `migrations/` D1 schema · `test/` the worker test suite · `scripts/`: `vapid.ts` (`bun run vapid`),
  `auth-schema.ts` (Better Auth CLI input for 0015). Each script's header has its exact command.
- Every Hono app, `Context` and `MiddlewareHandler` uses `AppEnv` from `../index` (type-only), as
  does `Env`; never redeclare either.

## Auth

- `auth-options.ts` is a pure `authOptions(env)`: the schema CLI and the tests build their instance
  from it. `auth.ts` is the module-scope instance (`env` from `cloudflare:workers`, e-mail sent in
  `waitUntil`).
- The e-mailed link is never Better Auth's verify GET (mail scanners would burn the token): web =
  `${WEB_URL}/verify#token=...`, app = `${WEB_URL}/auth/app?token=...`. An app request stores a
  `magic_link_challenge`; the `before` hook rejects `/magic-link/verify` unless `x-mewki-verifier`
  hashes (S256) to it, before the token is consumed.
- Google in the app: `oneTimeToken` (hashed, 3 min). Its `generateToken` demands `?challenge=` and
  stores it in `magic_link_challenge`; the same `before` hook rejects `/one-time-token/verify` unless
  `x-mewki-verifier` matches, with no web exception (every one-time token is the app's).
- `LINK_TTL_S` (600) is mirrored by `copy.inbox.hint` in `apps/web/src/components/auth/copy.ts`;
  change both. Sends are capped at one per e-mail per minute in `magic_link_sent`.
- The same e-mail carries a 6-digit code (`emailOTP`, hashed, 3 attempts, `LINK_TTL_S`), minted in
  `sendMagicLink` and spent at `POST /sign-in/email-otp` (under `AUTH_LIMITER`). The `before` hook
  404s every other `/email-otp/*` route, so a code never goes out without the captcha and the
  cooldown. The code is not device-bound: it proves the inbox, like a web link.
- Better Auth's built-in rate limit stays off: it counts in isolate memory. `AUTH_LIMITER` (by
  `cf-connecting-ip`) is the real one.
- `requireAuth` reads `plan` from D1, not from the session: the 5-minute `cookieCache` still holds
  the plan from before a checkout.
- MCP (`POST /mcp`, bd `Dailify-7yoo.1`): `jwt` + `@better-auth/mcp` make Better Auth an OAuth 2.1
  provider with open dynamic registration; login and consent pages are the web's `/login` and
  `/oauth/consent`. Access tokens are JWTs bound to `mcpResource(env)` (`${BETTER_AUTH_URL}/mcp`);
  `mcpUserId` (`auth.ts`) verifies one. Only `requireTaskAuth` (the tasks module) accepts it
  besides `/mcp`, so the token never opens billing, settings or the AI routes. Discovery:
  `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server/auth`.
- The provider seeds `oauthResource` at init, outside a request on Workers; that fails quietly
  and is retried on first use.

## Errors

- App routes answer `{ ...extra, error }` through `fail` (`lib/errors.ts`).
- `/auth/*` is Better Auth's handler and answers its own `{ message, code }`.
- Unknown routes get `app.notFound` -> `fail(c, 404, "Not found")`.

## wrangler.toml

- The first `ALLOWED_ORIGIN` entry is `WEB_URL`, the host of every magic link.
- `[[send_email]] allowed_sender_addresses` must equal `entrar@${APP_HOST}`
  (`lib/email/providers/cloudflare.ts`), or no sign-in e-mail goes out.
- The `*/5` cron is the alert granularity.
- Ratelimit `namespace_id`s (1001-1003) are per account; reusing one in another Worker shares its
  counters. Limits and which routes use each: `src/routes/CLAUDE.md`.
- `[observability]` is on and source maps upload: `wrangler deploy` turns off what the file omits,
  so change logging here, not in the dashboard.
- New binding or secret: the files are in RULES.md "Backend and API"; vitest reads `wrangler.toml`
  via `configPath`. Type it optional in `Env` only when the code runs without it (the limiters).
  `test/env.d.ts` adds `TEST_MIGRATIONS`/`LIVE_*`.

## Cron

`scheduled` runs `dispatchAlerts` (`alerts.ts` + `lib/occurrence-alert.ts`), `syncOldest` (the
25 oldest Calendar connections, one at a time because of the subrequest ceiling) and
`sweepMagicLinks` (`db/user.ts`), each in its own `waitUntil`. `syncIfDue`
isolates each user; `dispatchAlerts` isolates each send, and `sendPush` answers 410 for keys that
can't encrypt, so the subscription is deleted.

## Local dev and deploy

- Wrangler auto-loads `apps/server/.env`. Don't add a `.dev.vars`: it shadows `.env`. Neither is
  hot-reloaded, so restart `bun run dev:api` after editing.
- Locally `ALLOWED_ORIGIN` must list `https://localhost:1420` first (vite with mkcert,
  `strictPort`), or CORS fails and magic links point at prod.
- `bun run dev` and `bun run deploy` apply migrations first; the Workers Builds deploy command must
  be `bun run deploy` (why: `migrations/CLAUDE.md`).

## Verify

`bun run check` in `apps/server` (prettier, eslint, `tsc --noEmit`, vitest); one file:
`bun run test test/<file>`. Harness details: `test/CLAUDE.md`.
