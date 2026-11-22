# Clerk → Better Auth + magic link com deep link (rzz.1 / rzz.2)

Pesquisa de 2026-11-17 (5 agentes: Better Auth em Workers, migração do Clerk, mapa do código, deep
link no Tauri, e-mail). Este arquivo é o contrato entre server, web e app — mude aqui antes de mudar
um lado só.

## Decisões

- `better-auth@1.7.25` nos dois pacotes. D1 passado direto (`database: env.DB`, sem ORM/kysely).
  Instância no escopo do módulo via `import { env, waitUntil } from "cloudflare:workers"`; as opções
  ficam numa função pura `authOptions(env)` (sem `cloudflare:workers`) pra CLI e testes.
- Montado em **`/auth/*`** (`basePath: "/auth"`) no Worker. Em dev o proxy do Vite tira o `/api`,
  então o cliente fala com `${apiURL}/auth` nos dois ambientes. `baseURL` = `BETTER_AUTH_URL`
  (`https://api.mewki.mxrqz.com`).
- **Sessão**: web por cookie httpOnly (`api.mewki` e `mewki` são o mesmo site → `SameSite=Lax`
  basta), `cookieCache` 5 min. App Tauri por `bearer()` (header `set-auth-token` → cofre do sistema).
  Um middleware só (`auth.api.getSession({ headers })`) atende os dois e põe `userId` e `plan` no
  contexto. CORS com `credentials: true` e `exposeHeaders: ["set-auth-token"]`.
- **IDs do Clerk preservados** (`user_…`): as tabelas do D1, a fila offline (`dailify:*:<userId>`) e
  a metadata `clerkUserId` das assinaturas Stripe continuam valendo. Não renomear a chave
  `clerkUserId` no Stripe (assinaturas vivas a carregam).
- `plan` e `stripeCustomerId` viram `user.additionalFields` com `input: false` (o usuário não se dá
  plano); `stripeCustomerId` com `returned: false`. `subscriptionActive`/`lastPayment`/`BillingDetails`
  morrem (eram escritos e nunca lidos). Fuso: `user_settings.time_zone` (já existe), não metadata.
- Webhook do Clerk (só `user.deleted`) → `user.deleteUser` com `beforeDelete` (cancela Stripe,
  `revokeAll` das integrações) e `afterDelete` (`deleteUserData`). Some `svix.ts`.
- Troca de uma vez (big-bang): todo mundo entra de novo; sem janela aceitando os dois.
- Rate limit embutido do Better Auth **desligado** (memória por isolate não serve no Worker): binding
  `AUTH_LIMITER` (por IP, 5/60 s) em `/auth/*` e checagem por e-mail (1/60 s) dentro do envio — se
  estourar, não envia e responde igual. Turnstile via plugin `captcha` em `/sign-in/magic-link`.
- **Perfil** por enquanto: nome editável + foto vinda do Google (ou a inicial). Telefone, username,
  upload de foto e MFA ficam pra depois (bd).
- Identificador do app: **`com.mewki.app`**.

## Magic link

- `magicLink({ expiresIn: 600, storeToken: "hashed", sendMagicLink })`. O `url` padrão do plugin
  aponta direto pro GET de verify — scanners de e-mail (Safe Links) queimam o token. Então o link
  do e-mail é montado por nós a partir do `token`:
  - pedido pela **web**: `${WEB_URL}/verify#token=<token>` — a página mostra "Entrar" e só no clique
    chama `authClient.magicLink.verify({ query: { token } })`. O `#` nunca chega a servidor nenhum.
  - pedido pelo **app** (`metadata.challenge` presente): `${WEB_URL}/auth/app?token=<token>`. No
    celular com o app, o sistema abre o app (Universal/App Links em `/auth/app`). Sem o app ou no
    desktop, a página tenta `mewki://auth?token=…` uma vez e mostra "Abrir na Mewki" + "Entrar pelo
    navegador". Essa página **nunca** chama verify.
- Amarração ao aparelho (PKCE-like, ~25 linhas nossas): o app gera `verifier` (32 bytes base64url),
  manda `challenge = base64url(sha256(verifier))` em `metadata`. `sendMagicLink` grava
  `(sha256(token), challenge, expires)` numa tabela `magic_link_challenge`. Um `hooks.before` em
  `/magic-link/verify` exige o header `x-mewki-verifier` cujo S256 bate com o challenge — e lança
  antes de consumir o token. Link pedido pela web não tem linha → passa.
- `WEB_URL` = primeira origem de `ALLOWED_ORIGIN`.

## E-mail

- `apps/server/src/lib/email/`: `index.ts` exporta `sendEmail(env, message)` e escolhe o provedor;
  `providers/cloudflare.ts` usa o binding `send_email` (`EMAIL`, remetente
  `entrar@mewki.mxrqz.com`). Resend entra como outro arquivo em `providers/` se o Cloudflare (beta)
  der problema. Template em TS puro (`templates/magic-link.ts` → `{ subject, html, text }`), pt-BR,
  sem React Email, sem imagens/pixels, botão + link em texto, "expira em 10 min", "não pediu? ignore".
- Envio não bloqueia a resposta: `backgroundTasks: { handler: waitUntil }`.
- Testes mockam `lib/email` como `alerts.test.ts` mocka `sendPush`.

## Google

- Web: `authClient.signIn.social({ provider: "google", callbackURL, errorCallbackURL })`. Mesmo
  `GOOGLE_CLIENT_ID/SECRET` da integração Agenda; redirect URI nova:
  `https://api.mewki.mxrqz.com/auth/callback/google`. `accountLinking.trustedProviders: ["google"]`.
- App: navegador do sistema (`/auth/google?challenge=`) + `oneTimeToken()` → `mewki://auth?ott=…`,
  amarrado ao verifier do app como o magic link (`apps/server/CLAUDE.md`, Auth).

## Contrato do cliente web — `apps/web/src/lib/auth.ts` (já existe)

`authClient` (magicLink + `plan` inferido), `useSession()` (`{ data: { user, session } | null,
isPending }`, `user = { id, email, name, image, emailVerified, plan }`), `setBearer`/`authHeaders`
(o app nativo injeta o token; na web é vazio), `planOf(user)`. `api.ts` deixa de receber `token`:
manda `credentials: "include"` + `authHeaders()`.

## Env

Server: `BETTER_AUTH_SECRET` (≥ 32 chars), `BETTER_AUTH_URL`, `TURNSTILE_SECRET_KEY`, binding
`EMAIL`, ratelimit `AUTH_LIMITER`; saem `CLERK_*`. Web: `VITE_TURNSTILE_SITE_KEY`; sai
`VITE_CLERK_PUBLISHABLE_KEY`. Chaves de teste do Turnstile: site `1x00000000000000000000AA`,
secret `1x0000000000000000000000000000000AA`.

## Migração dos usuários (o dono roda, não agente)

A ordem importa: o import (passo 3) roda ANTES do deploy que liga o Better Auth (passo 4). Um login
depois do deploy cria um `"user"` novo com o mesmo e-mail, e o import falha no `UNIQUE(email)` — de
propósito (o script não usa `ON CONFLICT DO NOTHING`: pular a linha orfanaria as tarefas do id do
Clerk em silêncio). Se falhar mesmo assim, juntar o duplicado à mão antes de reaplicar. O SQL gerado
abre com esse aviso.

1. `wrangler d1 migrations apply dailify --remote` (cria `user/session/account/verification` +
   `magic_link_challenge`).
2. `CLERK_SECRET_KEY=… bun apps/server/scripts/clerk-to-d1.ts > clerk-import.sql` (gitignored), revisar.
3. `wrangler d1 execute dailify --remote --file clerk-import.sql` — antes do passo 4.
4. Só agora: deploy server + web juntos. Clerk fica read-only algumas semanas, depois rotaciona e apaga.

## Fontes

- https://better-auth.com/docs/integrations/hono · /docs/plugins/magic-link · /docs/plugins/bearer ·
  /docs/plugins/captcha · /docs/concepts/rate-limit · /docs/guides/clerk-migration-guide
- https://github.com/better-auth/better-auth/blob/v1.7.15/docs/content/blogs/1-5.mdx (D1 nativo)
- https://v2.tauri.app/plugin/deep-linking/ · https://developers.cloudflare.com/email-service/
- Exemplos: thunderbird/thunderbolt (Better Auth + Tauri + app links), daveyplate/better-auth-tauri
