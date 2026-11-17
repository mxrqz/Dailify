# `apps/server` — Hono backend (Cloudflare Workers + D1)

The only writer of app data. The web app never touches D1/Stripe/OpenAI directly — everything goes
through here with a Clerk bearer token. Deployed as the `dailify-server` Worker (api.mewki.mxrqz.com; api.dailify.mxrqz.com still routes).

## Layout

- **`src/index.ts`** — app root: CORS (`ALLOWED_ORIGIN`), `/health` (before auth), `clerkMiddleware`,
  route mounts, and the `app.onError` JSON envelope (`{ error }`, 500). `Env` (the bindings +
  secrets interface) lives here — import `Env` from `../index`, don't redeclare it.
- **`src/routes/`** — `tasks.ts` (CRUD + month read + `GET /tasks/undated`), `settings.ts` (`GET`/`PUT /settings`, `weekStart`), `voice.ts` (`POST /tasks/voice` + `POST /tasks/parse`, the AI routes),
  `billing.ts` (checkout, portal, payment details, invoices, `POST /webhooks/stripe`),
  `push.ts` (VAPID key + subscriptions), `clerk-webhook.ts` (`user.deleted` → wipe),
  `integrations.ts` (`GET /integrations`, `POST /:p/connect`, `POST /:p/callback`, `DELETE /:p`,
  `POST /integrations/google-calendar/events` = a action `create-event`, `POST …/events/:taskId/sync`
  = o retry do "não sincronizado", `GET …/events?from&to&tz` = leitura sob demanda da janela (≤62
  dias, nada guardado), `POST …/links` = "Vincular" tarefa a evento existente).
- **`src/integrations/`** — providers externos (epic `zpq`): `types.ts` (`Provider`, `Ctx`),
  `oauth.ts` (code + PKCE em fetch puro, `InvalidGrantError`), `crypto.ts` (AES-GCM dos tokens),
  `connection.ts` (`loadCtx`/`makeCtx`: bearer + refresh preguiçoso, revogação best-effort),
  `registry.ts` (`PROVIDERS`), um diretório por provider. Provider novo = id em `INTEGRATIONS`
  (`@dailify/shared`) + módulo aqui; o teste de contrato em `test/integrations.test.ts` cobra o resto.
- **`src/alerts.ts`** — `dispatchAlerts`, the Cron Trigger pass that sends due task alerts.
- **`src/db/`** — `tasks.ts` (all D1 queries), `settings.ts` (`weekStart` por usuário), `limits.ts` (`enforceCreate` tier gate),
  `push.ts` (subscriptions + due-alert query), `calendar-sync.ts` (claim/token/vínculos do sync da Agenda).
- **`src/integrations/google-calendar/sync.ts`** — `syncCalendar`: eventos da agenda principal viram
  tarefas (full 30 dias ou incremental pelo syncToken; 410 = full). Roda no `waitUntil` do `GET /tasks`
  e no cron (25 conexões mais antigas); o `UPDATE … RETURNING` do `synced_at` é throttle de 60 s e
  lock. LWW por `updated` × `updatedAt`, eco por `remote_updated`; nunca chama a propagação.
- **`src/lib/`** — `clerk.ts` (client + `getUserRole` from `privateMetadata.plan`), `stripe.ts`,
  `openai.ts` (`transcribe` = `gpt-4o-mini-transcribe`; `interpretText` = texto → `AiParse`, o prompt da Mew), `errors.ts` (`fail`),
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
- **`repeatEvery` (coluna `repeat_every`, `0010`)**: NULL = 1, e só 2..365 entra. No PATCH, `null`
  volta a 1 (ausente mantém, como o `alert`); série que vira `Off` perde o intervalo (`everyCol`).
- **Sem data = flag `undated`**: `date` vira só âncora e a tarefa fica fora da leitura do mês; lista via `GET /tasks/undated`.
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
- **IA**: voz e `POST /tasks/parse` passam pelo mesmo `interpretText`. GPT recebe **hora local
  ingênua** e as datas voltam reinterpretadas no fuso do cliente (Clerk `unsafeMetadata` é só
  fallback da voz). `/parse` só devolve rascunhos (`{ reply, intent, drafts }`); a voz cria.
  **`targets` (F6)**: o `/parse` passa as conexões `active` que o plano libera; elas viram o enum
  do schema e a linha "Integrações conectadas" do prompt (nenhuma = `maxItems: 0`), e `toDraft`
  ainda descarta o que não estiver nelas. A IA só sugere: o web liga a etiqueta e a pessoa confirma.
  A voz passa `[]` (cria sem confirmação).
- **Crédito `ai`: `enforce` antes de chamar a OpenAI, débito só depois de uma resposta dentro do
  contrato.** Falha, timeout ou JSON fora do shape → 502 sem débito. `question`/`unsupported`
  válidos debitam (a IA foi usada). Voz = transcrição + leitura = 1 crédito.
- **Voz tenta o parser local antes do GPT.** O transcrito passa por `parseTaskText` (`@dailify/shared`)
  no fuso do cliente; sem `unsure` e com título, vira o rascunho direto e o GPT nem é chamado. Senão,
  `interpretText`. Os dois caminhos passam por `draftToTask` (= `composeTaskInput` do shared, a regra do composer) e custam o mesmo 1 crédito (a transcrição
  é IA); falha na transcrição não debita.
- **Integrações**: o `redirect_uri` é **rota do SPA** (`${appOrigin}/integrations/<p>/callback`),
  não do worker — o SPA posta `{ code, state }` com o bearer, e o callback exige
  `state.user_id === userId` (o state é de uso único, `DELETE … RETURNING`, 10 min). Sem isso dá pra
  vincular a conta Google de alguém à sessão de outro. Scope obrigatório (`oauth.required`) que não
  veio concedido → 400 sem gravar. Tokens só em repouso cifrados (`v1.<iv>.<ct>`, AAD
  `user:provider`); `invalid_grant` no refresh marca a conexão `revoked`. Gate por plano em
  `INTEGRATIONS[id].roles`, não em `QUOTAS`; o `DELETE` não tem gate (desconectar sempre pode).
  Action = `parse`/`preview`/`run`; falha esperada é `ActionError` (status + `code`). O evento do
  Google tem id = base32hex do id da tarefa: 409 do Google vira PATCH (retry idempotente), e o
  `htmlLink` entra nos links da tarefa via `updateTask` — é ele que o web lê como "já vinculada".
  **Propagação (F4)**: PATCH/DELETE de tarefa (inclusive `?occurrence=`) com vínculo chamam
  `propagate` (`integrations/propagate.ts`) no `waitUntil` → `Provider.onTaskChanged`. Só chama o
  Google se o evento remontado (no `time_zone` do vínculo) mudou; sem dia ou apagada = delete +
  vínculo e `url` saem. Concluir não propaga. Falha = `stale` (o web oferece reenviar), nunca
  derruba a escrita da tarefa. **Vincular (F7)**: só marca o `mewkiTaskId` no evento e grava o vínculo; o
  evento fica como está até a próxima edição da tarefa, que o sobrescreve (título, horário, descrição). Teste de rota que toca vínculo passa `createExecutionContext()`.
- **Stripe webhook** needs the **raw body** for signature verification — keep it off any body
  parser and verify async (`constructEventAsync`).

## Secrets & local dev

`Env` fields beyond `DB`/`ALLOWED_ORIGIN`/limiters are secrets (`wrangler secret put`, or `.env`
locally — see `.env.example`). O par VAPID sai de `bun run vapid`; o `CLERK_WEBHOOK_SECRET` sai do
endpoint de webhook criado no dashboard do Clerk (evento `user.deleted`, URL `/webhooks/clerk`).
`GOOGLE_CLIENT_ID`/`_SECRET` saem do OAuth client do Google Cloud; `TOKEN_KEY_V1` = `openssl rand
-base64 32` e **nunca muda** (rotação = `TOKEN_KEY_V2` em `integrations/crypto.ts`). `wrangler.toml` holds the D1 `database_id` and
`[vars] ALLOWED_ORIGIN` — the **prod** origins, comma-separated (`lib/origin.ts`: CORS accepts any of them, Stripe redirects return to the caller's), so `.env` must override it locally
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
