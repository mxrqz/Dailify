# `apps/server` — Hono backend (Cloudflare Workers + D1)

The only writer of app data. The web app never touches D1/Stripe/OpenAI directly — everything goes
through here with a Clerk bearer token. Deployed as the `dailify-server` Worker (api.dailify.mxrqz.com).

## Layout

- **`src/index.ts`** — app root: CORS (`ALLOWED_ORIGIN`), `/health` (before auth), `clerkMiddleware`,
  route mounts, and the `app.onError` JSON envelope (`{ error }`, 500). `Env` (the bindings +
  secrets interface) lives here — import `Env` from `../index`, don't redeclare it.
- **`src/routes/`** — `tasks.ts` (CRUD + month read), `voice.ts` (also mounted under `/tasks`),
  `billing.ts` (checkout, portal, payment details, invoices, `POST /webhooks/stripe`).
- **`src/db/`** — `tasks.ts` (all D1 queries), `limits.ts` (`enforceCreate` tier gate).
- **`src/lib/`** — `clerk.ts` (client + `getUserRole` from `privateMetadata.plan`), `stripe.ts`,
  `openai.ts` (`transcribe` = `gpt-4o-mini-transcribe`), `errors.ts` (`fail`).
- **`src/middleware/auth.ts`** — `requireAuth` sets `c.get("userId")`; re-exports `clerkMiddleware`.
- **`migrations/`** — D1 SQL. `test/` — the vitest suite.

## Non-obvious invariants

- **Every route returns errors via `fail(c, status, msg)`** → `{ error: string }`. The web client
  checks `res.ok`; a non-ok body is always this shape. Don't hand-roll error JSON.
- **Auth**: mount `requireAuth` on a route group, then read `c.get("userId")` — never trust a
  user id from the request body. `getUserRole` does a **direct** `getUser(id)` (the old server's
  `getUserList().find()` silently broke past 10 users — don't reintroduce that).
- **Tiering is enforced here, not on the client.** `enforceCreate` reads `PLAN_PERMISSIONS`
  (`@dailify/shared`) by capability; `-1` = unlimited. The client gate is cosmetic — this is the
  real one (epic `d69`).
- **Dates are epoch-ms `number`s** in/out (same `Task` as the web). The month read expands recurring
  server-side (`expandRecurringTask`) and dedupes by `` `${id}-${date}` `` before returning.
- **Voice**: `voice.ts` caps upload at 5MB and checks `audio/*` **before** calling OpenAI; GPT is
  prompted in **naive local time**, then dates are reinterpreted with the user's Clerk `timezone`.
  DST/month-edge correctness is the one thing that needs live verification (bd `3uv`).
- **Stripe webhook** needs the **raw body** for signature verification — keep it off any body
  parser and verify async (`constructEventAsync`).

## Secrets & local dev

`Env` fields beyond `DB`/`ALLOWED_ORIGIN` are secrets (`wrangler secret put`, or `.dev.vars` /
`.env` locally — see `.env.example`, 9 secrets). `wrangler.toml` holds the D1 `database_id` and
`[vars] ALLOWED_ORIGIN` — which is the **prod** origin, so `.env` must override it locally
(`https://localhost:1420`; vite uses mkcert + `strictPort`). Wrangler doesn't hot-reload `.env`.
`bun run dev` applies pending D1 migrations locally (`CI=1` skips the prompt) before `wrangler dev`. Clerk + Stripe keys are **paired per instance**: a `pk_live` front end
must match an `sk_live` worker or all auth 401s.

## Deploy & migrations

`bun run deploy` aplica as migrations pendentes em `--remote` **antes** do `wrangler deploy`, nessa
ordem. O deploy real vem do **Workers Builds** (Cloudflare conectado ao repo, não GitHub Actions), e
é o *deploy command* configurado no dashboard do worker `dailify-server` que precisa apontar pra cá
— se ele estiver como `npx wrangler deploy` cru, a migration não roda e o script aqui não adianta.

Por que a ordem importa: worker novo sobre schema velho derruba todo `POST`/`PATCH` de tarefa com
`no such column`, e o `SELECT` sobrevive — o app parece saudável até alguém salvar. Já aconteceu com
a `0002`.

O caso que essa ordem **não** cobre é a migration destrutiva (`DROP COLUMN`): entre ela e o worker
novo subir, o worker antigo ainda no ar perde uma coluna que usa. Para essas, o seguro é publicar em
dois passos — aditiva + deploy primeiro, destrutiva depois que o novo estiver no ar.

## Tests

`bun run test` (or `bun --filter @dailify/server test`) — `@cloudflare/vitest-pool-workers` runs
against a real D1 (migrations applied in `beforeAll` via `applyD1Migrations`). Clerk/Stripe/OpenAI
are `vi.mock`ed. Add a test with every route/query change; assert the tier gate and the epoch-ms
shape. No `as` assertions; see root `CLAUDE.md`.
