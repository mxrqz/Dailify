# Mewki

Mewki is a task agenda with an AI assistant, the Mew. This bun monorepo holds the React web app
(also shipped as a Tauri Android/desktop app), its Hono API on Cloudflare Workers + D1, and the
TypeScript model both share. Package names, the D1 database, the Workers and storage keys still say
"dailify": those are persisted names, so don't rename them in passing.

@RULES.md

## Commands

```bash
bun install
bun run dev            # API (wrangler :8787, local migrations first) + web (https://localhost:1420)
bun run dev:frontend   # web only
bun run dev:api        # API only
bun run build          # web: tsc + vite build -> apps/web/dist
bun run test           # vitest, every package (one file: `bun run test <path>` in the package dir)
bun run lint           # eslint, every package
bun run format         # prettier --write, every package
bun run check          # the gate: format:check + lint + typecheck + test, every package
```

## Map

Each area's `CLAUDE.md` loads when you touch a file in it and holds only that folder's invariants.

| Working on                                    | Code                                           | Doc                              |
| --------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| Web tooling, folder layers, web test harness  | `apps/web`                                     | `apps/web/CLAUDE.md`             |
| Design tokens, `global.css`, motion           | `apps/web/src/global.css`                      | `apps/web/src/CLAUDE.md`         |
| App shell, shared state, root widgets         | `apps/web/src/components`                      | `components/CLAUDE.md`           |
| Primitives (vendored shadcn, DS kit)          | `components/ui`, `components/kit`              | one per folder                   |
| Agenda, composer, task form, navigation       | `components/dashboard`                         | `components/dashboard/CLAUDE.md` |
| Landing, Mew mascot, Mew chat, sign-in UI     | `components/{landing,mew,mew-chat,auth}`       | one per folder                   |
| Task writes, offline settle, module stores    | `apps/web/src/hooks`                           | `hooks/CLAUDE.md`                |
| API client, offline queue, pure helpers       | `apps/web/src/functions`                       | `functions/CLAUDE.md`            |
| Auth client, Tauri and browser adapters       | `apps/web/src/lib`                             | `lib/CLAUDE.md`                  |
| Routes and pages                              | `apps/web/src/pages`                           | `pages/CLAUDE.md`                |
| Constants, legacy type aliases                | `apps/web/src/{consts,types}`                  | one per folder                   |
| Tauri shell, Android build and release        | `apps/web/src-tauri`                           | `src-tauri/CLAUDE.md`            |
| API server: layout, auth, cron, bindings      | `apps/server`                                  | `apps/server/CLAUDE.md`          |
| HTTP routes, D1 queries, services, providers  | `apps/server/src/{routes,db,lib,integrations}` | one per folder                   |
| D1 schema changes                             | `apps/server/migrations`                       | `migrations/CLAUDE.md`           |
| Server tests                                  | `apps/server/test`                             | `test/CLAUDE.md`                 |
| Shared model, quotas, recurrence, task parser | `packages/shared`                              | `packages/shared/CLAUDE.md`      |
| CI workflows                                  | `.github/workflows`                            | `.github/workflows/CLAUDE.md`    |

## Gotchas

- Hosting: the web is the Worker `dailify` (static assets with SPA fallback,
  `apps/web/wrangler.jsonc`) on mewki.mxrqz.com, with dailify.mxrqz.com still served; the API is the
  Worker `dailify-server` on api.mewki.mxrqz.com. Cloudflare Workers Builds deploys both, D1
  migrations included, on every push to `main`. GitHub Actions only builds the signed Android
  release on `v*` tags.
- Auth is Better Auth: an httpOnly cookie on the web, a bearer token in the OS keyring in the Tauri
  app. Notes that mention Clerk, Firestore, Vercel or Render are stale; the Stripe metadata key
  `clerkUserId` stays only because live subscriptions carry it.
- The Tauri shell is live, not vestigial: native magic-link auth, deep links, haptics, the Android
  back button and signed Android builds. Native code is only plugins; logic stays in web or server.
- Env files are per app (`apps/web/.env`, `apps/server/.env`, gitignored; copy each `.env.example`),
  and a git worktree needs its own copies. Only `VITE_*` variables reach the web bundle.
- Vite holds port 1420 with `strictPort`, and the main checkout's dev server often has it. Start a
  worktree's web elsewhere (`bun run dev --port 1425` in `apps/web`) and check `ss -tlnp | grep 142`
  before trusting the screen.
- Toolchain: bun 1.3.9 with the isolated linker. TypeScript is 5.9 at the root and in shared, 5.6 in
  `apps/web` and 7 in `apps/server`; typescript-eslint can't load TS 7, which is why ESLint for
  shared and server lives in the root `eslint.config.js`.
- Plans are Free/Pro/Max and the only quota is AI credits (`QUOTAS` in
  `packages/shared/src/quotas.ts`). The server is the real gate; the client check is cosmetic.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

Push policy: never `git push` unless the user asks (`RULES.md`, "Git and task tracking"). That
overrides step 4 above; bd regenerates the block between the markers, so the override lives here.

## Changing the app domain (e.g. mewki.app)

App Links and the Stripe/e-mail return paths hang on one host. To move it:

1. `APP_URL` in `packages/shared/src/app-url.ts` (server checkout return, e-mail sender, web link parser).
2. `host` of the mobile deep link in `apps/web/src-tauri/tauri.conf.json`, then rebuild the app.
3. `[vars] ALLOWED_ORIGIN` in `apps/server/wrangler.toml` (first entry = the web origin).
4. Serve `apps/web/public/.well-known/*` on the new domain, add it as a Cloudflare Email sending
   domain and as a Turnstile hostname.
5. `allowed_sender_addresses` in `apps/server/wrangler.toml` must stay `entrar@<APP_HOST>`: the
   sender is built from `APP_HOST` (`apps/server/src/lib/email/providers/cloudflare.ts`), and a
   mismatch fails every magic-link e-mail, so nobody can sign in.
6. Add `https://<new host>/integrations/google-calendar/callback` to the Google OAuth client's
   authorized redirect URIs (the Calendar callback is an SPA route on the web origin).
