# apps/server/src/integrations — provider integrations

OAuth providers: connecting, sealing the tokens, pushing task edits out (`google-calendar`, whose
objects mirror tasks) and the Mew's on-demand reads and sends (`slack`). Repo-wide rules:
`/RULES.md` ("Backend and API"). Google's event mapping and sync: `google-calendar/CLAUDE.md`.

## Layout

- `types.ts` `Provider`, `Ctx`, `ActionError` · `registry.ts` `PROVIDERS` · `links.ts`
  `appendLinks` (capped) and `withoutLink` for `task.links` · `oauth.ts`
  code + PKCE (S256) on plain fetch, `InvalidGrantError` · `crypto.ts` token sealing ·
  `connection.ts` `makeCtx`/`loadCtx`, `sealTokens`/`openTokens`, best-effort `revokeSealed` ·
  `propagate.ts` task edits to providers · `<id>/` one folder per provider.
- Routes live in `routes/integrations.ts`; SQL in `db/integrations.ts` and `db/calendar-sync.ts`.

## Adding a provider

1. Id, `roles` and `tasks` in `INTEGRATIONS` (`packages/shared/src/integrations.ts`). `roles` is
   the plan gate (`canUseIntegration`), not `QUOTAS`. `tasks: true` makes it an AI `targets`
   destination (`aiTargets`); the Mew's apps come from every active one (`activeIntegrations`).
2. `integrations/<id>/index.ts` exports a `Provider`: `oauth` (endpoints, `scopes`, `required`,
   `credentials(env)`), `identify`, optional `onTaskChanged` and `sync`. Expected action failures
   throw `ActionError(status, msg, extra)`, which the route maps to `fail`.
3. Register it in `PROVIDERS`; `satisfies Record<ProviderId, Provider>` makes a missing entry a
   compile error.
4. Credentials in `Env`, `.env.example` and `vitest.config.ts`. Without them the status row is
   `configured: false` and `connect` answers 503.
5. The "contrato dos providers" block in `test/integrations.test.ts` then checks https endpoints,
   `required` within `scopes`, credentials and `identify`.
6. Mew capabilities, optional: `read(env, userId, target)` returns text the Mew may read,
   `send(env, userId, target, text)` delivers a confirmed draft, and `target` says what a target
   is for the prompt ("channel id"). Only connected providers that implement one are offered to
   the model (`appsOf`, `routes/mew.ts`). A read runs after a `permission` box or an "always"
   grant (`mew_grants`, deleted on disconnect); a send only from `POST /mew/actions/:id/send`,
   never automatic. Test with a fake on the mocked registry (`test/mew-apps.test.ts`).

Gotcha: the registry is only half used. The generic `/:provider/callback` runs the optional
`Provider.sync` (the first import), but the action routes are hardcoded to Google (`withCalendar`,
`createEvent`, `replaceMeet`; `createEvent` is a plain `{ parse, run }`). A second provider needs
those routed through `PROVIDERS[id]` first.

## Ctx.api and tokens

- All provider HTTP goes through `ctx.api` (`makeCtx`): it adds the bearer and refreshes 60 s before
  expiry, saving the new sealed tokens. On `invalid_grant` it marks the connection `revoked` and
  rethrows; routes answer 409 with `code: reconnect`. Providers never read tokens.
- `ctx.api`, `tokenRequest` and `revoke` default to `AbortSignal.timeout(15_000)`, so providers
  don't set their own.
- Parallel calls on one `Ctx` can refresh twice (the `ponytail:` in `makeCtx`). Memoize the refresh
  promise before adding a provider that rotates its refresh token.
- At rest: `v1.<iv>.<ct>`, AES-GCM with AAD `userId:provider`, so a blob copied to another row
  won't open. `TOKEN_KEY_V1` never changes; rotation = `TOKEN_KEY_V2` plus a `v2` entry in `KEYS`
  (`crypto.ts`), and v1 rows stay readable.

## OAuth flow

- `redirect_uri` is an SPA route (`${returnBase}/integrations/<id>/callback`), not the Worker: the
  SPA posts `{ code, state }` with its session, which ties the external account to the signed-in
  user.
- `state` is single-use (`consumeState`: `DELETE ... RETURNING`, 10 min) and must match `user_id`
  and the provider, else 403.
- A `required` scope left unticked on the consent screen answers 400 `code: missing_scope` and
  revokes the grant.
- From the Tauri app the consent page opens in the system browser, so `redirect_uri` comes from
  `returnBase`: `${APP_URL}/app/integrations/<id>/callback`, which `pages/app-return.tsx` hands to
  `mewki://open`, so the code reaches the app's session. That URI must be authorized on the Google
  OAuth client too.

## Slack (`slack/index.ts`, bd `Dailify-mbp`)

- User token only (acts as the person, sees what they see): `oauth.userToken` sends the scopes
  comma-joined in `user_scope`, reads the token from `authed_user`, and skips PKCE, because turning
  PKCE on makes the Slack app a public client for good. Token rotation stays off in the app
  settings, so there is no refresh token and `makeCtx` never refreshes. Scopes:
  `{channels,groups,im,mpim}:{read,history}`, `users:read`, `chat:write`; `required` =
  `channels:history`, `im:history`, `chat:write`. Revoke is `auth.revoke` with the token.
- Slack answers HTTP 200 with `ok: false`; `token_revoked`/`invalid_auth`/`account_inactive` mark
  the connection revoked. A 429 or an unknown target comes back from `read` as a plain note for
  the Mew (`Notice`), never a 502; `send` throws.
- `target`: `#canal`, `@pessoa` (an existing DM, matched on display, real or handle name), a raw
  `C…/D…/G…` id, or a message permalink (its thread: `thread_ts` from the query, else the `p…` ts).
  Names resolve with one `conversations.list` and one `users.list` page of 200 (the `ponytail:`).
- Unlisted (non-Marketplace) apps get `conversations.history`/`replies` at 1 call a minute and 15
  messages (Slack, May 2025), so a read is one of them with `limit=15`; a long thread shows its
  first 15. Marketplace approval lifts it. Message text is never stored: it goes straight into the
  Mew's turn.
- Redirect URLs on the Slack app: `${web origin}/integrations/slack/callback` and
  `${APP_URL}/app/integrations/slack/callback` (the Tauri app). Tests: `test/integrations-slack.test.ts`.

## Propagation and sync

- Task routes read `linkedTask` BEFORE the write, then run `propagate` in `waitUntil`. It never
  fails the write: a provider error or a missing connection sets the link `stale`, and the web
  offers a resend (`POST /integrations/google-calendar/events/:taskId/sync`, `before = null` =
  push without diffing).
- `onTaskChanged` returning `"unlink"` deletes the link and drops its `url` from `task.links` (the
  web reads that url as "linked"). A success clears `stale`. Completing a task does not propagate.
- Sync never calls `propagate`; echoes are caught by `remote_updated`. The cron runs `syncOldest`,
  which calls `syncIfDue` per user, each isolated.
- Disconnect has no plan gate. It revokes best-effort and deletes the connection and its links,
  never tasks: imported tasks become normal tasks. Reconnecting another account drops old links.

## Tests

- `test/integrations.test.ts` (crypto, PKCE, connect, callback, `Ctx.api`, disconnect, contract)
  and `test/integrations-{events,propagate,sync}.test.ts`.
- Providers are mocked with `vi.spyOn(globalThis, "fetch")` over a URL-to-handler map that throws
  on an unknown URL, so a new endpoint fails loudly.
- Route tests that touch links pass `createExecutionContext()` to `app.request` (without it
  `c.executionCtx` throws) and `await waitOnExecutionContext(ctx)` before asserting.
