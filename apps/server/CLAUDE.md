# `apps/server` — Hono backend (Cloudflare Workers + D1)

The only writer of app data. The web app never touches D1/Stripe/OpenAI directly — everything goes
through here with a Clerk bearer token. Deployed as the `dailify-server` Worker (api.dailify.mxrqz.com).

## Layout

- **`src/index.ts`** — app root: CORS (`ALLOWED_ORIGIN`), `/health` (before auth), `clerkMiddleware`,
  route mounts, and the `app.onError` JSON envelope (`{ error }`, 500). `Env` (the bindings +
  secrets interface) lives here — import `Env` from `../index`, don't redeclare it.
- **`src/routes/`** — `tasks.ts` (CRUD + month read), `voice.ts` (also mounted under `/tasks`),
  `billing.ts` (checkout, portal, payment details, invoices, `POST /webhooks/stripe`),
  `push.ts` (VAPID key + subscriptions), `clerk-webhook.ts` (`user.deleted` → wipe).
- **`src/alerts.ts`** — `dispatchAlerts`, the Cron Trigger pass that sends due task alerts.
- **`src/db/`** — `tasks.ts` (all D1 queries), `limits.ts` (`enforceCreate` tier gate),
  `push.ts` (subscriptions + due-alert query).
- **`src/lib/`** — `clerk.ts` (client + `getUserRole` from `privateMetadata.plan`), `stripe.ts`,
  `openai.ts` (`transcribe` = `gpt-4o-mini-transcribe`), `errors.ts` (`fail`),
  `task-input.ts` (validação do body), `push.ts` (Web Push), `svix.ts` (assinatura do webhook Clerk).
- **`src/middleware/auth.ts`** — `requireAuth` sets `c.get("userId")`; re-exports `clerkMiddleware`.
  **`rate-limit.ts`** — `rateLimit("API_LIMITER" | "VOICE_LIMITER")`, chaveado por usuário.
- **`migrations/`** — D1 SQL. `test/` — the vitest suite.

## Non-obvious invariants

- **Every route returns errors via `fail(c, status, msg)`** → `{ error: string }`. The web client
  checks `res.ok`; a non-ok body is always this shape. Don't hand-roll error JSON.
- **Auth**: mount `requireAuth` on a route group, then read `c.get("userId")` — never trust a
  user id from the request body. `getUserRole` does a **direct** `getUser(id)` (the old server's
  `getUserList().find()` silently broke past 10 users — don't reintroduce that).
- **Tiering is enforced here, not on the client.** `enforce`/`enforceCreate` (`db/limits.ts`) read
  `limitsFor(role)` (`@dailify/shared`) and count through `COUNTERS`, one per quota; `-1` = unlimited,
  `0` = blocked. The client gate is cosmetic — this is the real one (epic `d69`).
- **Todo body de tarefa passa por `lib/task-input.ts`** (`parseNewTask` / `parseTaskFields`) — não
  validar campo solto na rota. O `id` do POST **pode** vir do cliente (`parseClientId` valida só o
  formato): é o que permite à fila offline reenviar uma criação sem duplicar a tarefa que já está na
  tela. O PK do D1 é global, e quem impede colisão entre contas é o `WHERE tasks.user_id =
  excluded.user_id` do upsert (`db/tasks.ts`) — quando ele recusa, `insertTask` devolve `null` e a
  rota responde **409** em vez de fingir sucesso.
- **`updatedAt` é o carimbo do LWW** e atravessa o validador: a fila offline sobe com a hora da
  edição, não a do envio. `stampUpdatedAt` (`@dailify/shared`) recusa relógio adiantado além de 5min.
- **Dates are epoch-ms `number`s** in/out (same `Task` as the web). The month read expands recurring
  server-side (`expandRecurringTask`) and dedupes by `` `${id}-${date}` `` before returning.
- **Fuso vem do cliente, nunca do runtime.** O Worker roda em UTC, então `GET /tasks` aceita `?tz=`
  (IANA, validado com `IANAZone`) e repassa para `expandRecurringTask`/`startOfMonthMs` — sem isso a
  recorrência sai na hora errada e a tarefa perto da meia-noite cai no mês vizinho. Mesmo motivo do
  `from`/`to` do `DELETE /:id/complete`.
- **`PATCH /tasks/:id?occurrence=<epoch>`** = "editar só esta": a instância vira tarefa própria e a
  data entra em `tasks.exdates`, que `expandRecurringTask` pula. Devolve `{ task, series }` — o
  cliente precisa da série de volta pra reexpandir o mês sem a ocorrência antiga.
- **Alertas**: o Cron Trigger (`*/5 * * * *`) chama `dispatchAlerts`, que cobre tarefa avulsa **e**
  ocorrência de série (`lib/occurrence-alert.ts`). `alert_sent` impede o reenvio, e para a série ele
  guarda o **instante do alerta da última ocorrência avisada**, não a hora do envio — é o que deixa
  a próxima ocorrência valer. Série só é processada para quem tem device inscrito: é de
  `push_subscriptions.timezone` que sai o fuso.
- **Web Push é implementado à mão** (`lib/push.ts`, RFC 8291 + VAPID) porque as libs de npm são
  Node-only. `test/push.test.ts` valida contra o vetor da própria RFC — se mexer na derivação de
  chave, esse teste é o que avisa.
- **Voice**: `voice.ts` caps upload at 5MB and checks `audio/*` **before** calling OpenAI; GPT is
  prompted in **naive local time**, then dates are reinterpreted with the timezone the client sends
  (Clerk `unsafeMetadata` é só fallback).
- **Stripe webhook** needs the **raw body** for signature verification — keep it off any body
  parser and verify async (`constructEventAsync`).

## Secrets & local dev

`Env` fields beyond `DB`/`ALLOWED_ORIGIN`/limiters are secrets (`wrangler secret put`, or `.env`
locally — see `.env.example`). O par VAPID sai de `bun run vapid`; o `CLERK_WEBHOOK_SECRET` sai do
endpoint de webhook criado no dashboard do Clerk (evento `user.deleted`, URL `/webhooks/clerk`). `wrangler.toml` holds the D1 `database_id` and
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
