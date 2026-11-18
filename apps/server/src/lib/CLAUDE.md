# apps/server/src/lib — outbound services and input helpers

Repo-wide rules: [/RULES.md](../../../../RULES.md) ("Backend and API" covers timeouts, the AI credit
order and best-effort side effects; not repeated here). `lib/` never imports `routes/`.

## Layout (one module per external service, `env` passed explicitly)

- `openai.ts`: the AI kit. `openaiClient(env)` (a new client per call), `transcribe`, `PERSONA`,
  `clock(tz)`, `taskRules`/`taskSchema`, the guards, `readOutput`, `toEpoch`, `toDraft`,
  `draftToTask`, `structured` (the one Responses call), and `interpretText` (shared by
  `/tasks/parse` and voice). `mew.ts` builds the chat on top of it: `agendaOf`, `toBlocks`,
  `askMew`.
- `stripe.ts`: `stripeClient(env)` with `createFetchHttpClient` (Workers has no Node http), the
  price maps, `isProductName`, `activeSubscription`, the expandable-field normalisers, the invoice
  and payment DTOs, `handleStripeEvent` (every webhook branch, `handleInvoicePaid` among them) and
  `cancelSubscriptionsOf`. The checkout and portal calls still sit in `routes/billing.ts`.
- `push.ts`: Web Push written by hand (RFC 8291 payload, RFC 8292 VAPID) on WebCrypto, because the
  npm libraries are Node-only. On a 404/410 from `sendPush` the caller deletes the subscription.
- `encoding.ts`: base64url and `sha256b64url` (PKCE S256, the magic-link verifier hash).
- `email/`: `sendEmail` is the only entry point, with one file per vendor in `providers/` (today
  the Cloudflare `EMAIL` binding). Templates are pure, return `{ subject, text, html }`, and use
  inline styles with no images or tracking. `FROM` (`entrar@${APP_HOST}`) must be in wrangler.toml
  `allowed_sender_addresses`.
- `user.ts`: raw queries on the Better Auth `"user"` table, whose `plan` and `stripeCustomerId`
  only the server writes (`input: false`). `roleOf` maps an absent or unknown plan to `free`.
- `origin.ts`: `appOrigin` returns the caller's origin when it is allowed, otherwise the first
  `ALLOWED_ORIGIN`. `returnBase` sends native callers to `${APP_URL}/app`, because Stripe can't
  reopen the app. `NATIVE_ORIGINS` repeats the tauri entries of `ALLOWED_ORIGIN` by hand and also
  feeds Better Auth `trustedOrigins`, so change both together.
- `occurrence-alert.ts` (series alert math; `monthsTouching` is the one "which month starts does
  this window touch" helper), `errors.ts` (`fail`), `task-input.ts` (body gate).

## Input helpers: reuse before writing a guard

- `isRecord`: routes import it from task-input.ts; openai.ts still has its own copy (merge them).
  `isStringArray` is exported from openai.ts.
- task-input.ts: `validZone`, `isRecord`, `readJson`, `isEpochMs`, `parseMonth`, `parseOccurrence`,
  `isRepeatEvery`, `sanitizeLinks`, `parseClientId`, `parseTaskFields`, `parseNewTask`.
- Contract: an absent key keeps the stored value and `null` clears it (`alert`, `repeatEvery`,
  `tags`, `links`). Optional parsers are tri-state: `undefined`, `"invalid"`, or the value.
  `updatedAt` passes through (the offline queue's LWW stamp). `id`, `completed` and `exdates` never
  come from the body.
- `parseClientId` checks only the format (`^[A-Za-z0-9_-]{6,64}$`). The upsert's `WHERE user_id`
  in `db/tasks.ts` is what stops writes across accounts.

## AI calls

- Every Responses call goes through `structured(env, req, guard)` (`req` = name, schema,
  instructions, input, timeout): `MODEL`, `reasoning: { effort: "low" }`, `store: false`, a
  strict `json_schema`, then `readOutput`. `interpretText` passes 20 s, `askMew` 30 s, `transcribe` 20 s.
- `openaiClient` sets `maxRetries: 1`; the SDK retries timeouts, so a call can take 2× its timeout.
- The model gets naive local wall time (`clock`). `toEpoch(iso, tz)` reads its dates in the client
  zone, drops any `Z`/offset, and rejects values outside `DATE_RANGE`.
- Mew agenda: ±`WINDOW_DAYS` (14) plus the undated tasks, capped at `AGENDA_MAX` (300). A series
  instance's ref is `id@yyyy-mm-dd`, and `toBlocks` resolves refs only through that map.
- Agenda titles are untrusted (Google invites): `lines()` goes in as the first user-role input
  item, never into `instructions`. The client also sends `history`, assistant turns included.

## Stripe

- Read expandable fields only through `customerId`, `subscriptionId`, `priceIdOf` and
  `paymentMethodOf`. Narrow open Stripe enums to a DTO set (`knownInvoiceStatus`).
- Webhook writes never throw for a missing user: `updateUserRole` becomes a zero-row UPDATE. A
  throw makes Stripe retry and eventually disable the endpoint.
- The plan comes from `planLine` (the first non-proration subscription line): after a plan change
  Stripe lists the prorations, priced at the old plan, first. An unknown price never writes a role.
  `listInvoices` reads each invoice's own plan line and fetches a shared subscription once.
- `stripeClient` sets a 20 s timeout (SDK default 80 s).

## occurrence-alert

- For a series, `alert_sent` stores the alert instant of the last notified occurrence, not the send
  time. After a cron gap only the most recent due occurrence fires.
- The zone is `user_settings.time_zone`, else a device's `push_subscriptions.timezone`; only users
  with a subscription are scanned (`recurringAlertCandidates`, `db/push.ts`).

## Adding a service

1. `lib/<service>.ts`, or `lib/<service>/providers/` when the vendor may change, with a
   `<service>Client(env)` factory if there is an SDK. Routes call its domain functions and never
   chain SDK calls themselves.
2. Test at the module boundary: `vi.mock("openai")`, `vi.mock("stripe")`,
   `vi.mock("../src/lib/email")`, or a `fetch` spy.

## Tests (`apps/server/test/`)

- Unit: `push.test.ts` (the RFC 8291 vector; `encryptPayload`'s `fixed` exists only for it),
  `occurrence-alert`, `task-input`, `pricing-stripe`.
- Through routes: `tasks-parse` and `voice` (openai), `mew-chat`, `webhook`, `checkout` and
  `invoices` (stripe), `magic-link` and `account-delete` (email).
