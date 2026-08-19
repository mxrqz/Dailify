# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

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


## Build & Test

```bash
bun install
bun run dev           # vite dev server
bun run build         # tsc + vite build
bun run test          # vitest (run once)
bun --filter '@dailify/web' lint     # eslint
bun --filter '@dailify/web' format   # prettier --write src
bun run check         # format:check + lint + typecheck + test (full gate)
```

## Monorepo

This is a bun-workspaces monorepo (`apps/*`, `packages/*`). The web app lives at `apps/web`
(package `@dailify/web`); root `package.json` scripts (`dev`/`build`/`test`/`check`) delegate to
it via `bun --filter`, so the `Build & Test` commands above still work unchanged from the repo
root. Web deploy root (e.g. Cloudflare Pages) is now `apps/web`, build output `apps/web/dist`.

## Architecture Overview

See `bd memories architecture`. In short: web app on Cloudflare (dailify.mxrqz.com) inside a
vestigial Tauri shell. Auth = Clerk. All reads and writes go through the in-monorepo server
(`apps/server`, Hono on Cloudflare Workers + D1) via a thin fetch client
(`apps/web/src/functions/api.ts`) carrying a Clerk bearer token — no client-direct Firestore
access. Stripe billing and OpenAI voice task creation also run in `apps/server`. Dates are
epoch-ms numbers end to end. Plans: Free / Pro / Pro+AI.

**Stack:** React 18 + Vite + TypeScript (web) · Hono + D1 + Clerk + Stripe + OpenAI (server,
Cloudflare Workers) · Tailwind v4 + shadcn/ui · react-router · sonner · framer-motion. Package
manager: **bun**.

## Code map

Area-specific guidance lives in nested `CLAUDE.md` files (auto-loaded when you work in that folder):

- **`apps/web/src/functions/`** — data layer: `api.ts` (fetch client to `apps/server`) and pure,
  tested helpers (dates, task list ops). Start here for anything data-shaped.
- **`apps/web/src/components/`** — React components, shared state (`dailifyContext`), dark mode;
  shadcn in `ui/`.
- **`apps/web/src/types/`** — re-exports the shared TS model (`TaskProps`/`Task`, tiering
  `PermissionsProps`) from `@dailify/shared` and its invariants.
- **`apps/web/src/consts/`** — constants, plan ids, `apiURL`, color-token class names, priority
  scale.
- **`apps/web/src/pages/`** — routes, Clerk auth pages, Stripe checkout.
- **`apps/server/src/`** — the backend: Hono routes (`routes/`), D1 queries (`db/`),
  Clerk/Stripe/OpenAI clients (`lib/`), auth middleware. Its own vitest suite lives in
  `apps/server/test/`.
- **`packages/shared/src/`** — the canonical `Task`/`Permissions`/pricing/recurrence model,
  imported by both `apps/web` and `apps/server` so drift between client and server shapes is a
  compile error.

## Conventions & Patterns

- **No `as` type assertions.** Use type guards or proper types. `as const` is fine. Enforced as
  an ESLint *warning* while the ~50 existing ones are cleaned up gradually (bd issue `aqa`).
- **Formatting: Prettier** (`.prettierrc`, `printWidth: 100`). Run `bun --filter '@dailify/web'
  format` before committing; `bun run check` is the full gate (format + lint + typecheck + test).
- **Design tokens — no arbitrary values, ever.** This covers colors AND radii, and any other design
  value with a token. `rounded-[17px]`, `bg-[#151515]`, `border-[#242424]` are all defects: if a
  token fits, use it; if none fits, **add one**. Everything lives in `apps/web/src/global.css`:

  | what | defined at | exposed at | utilities |
  | --- | --- | --- | --- |
  | colors | `:root` (`--surface-*`, `--accent-*`, …) | `@theme inline` as `--color-*` | `bg-surface-panel`, `text-content-secondary`, … |
  | radii | `:root` (`--radius`, `--radius-panel`, `--radius-field`) | `@theme inline` as `--radius-*` | `rounded-panel`, `rounded-field`, `rounded-md`, … |
  | layout | `@utility` blocks near the end of the file | — | `px-gutter`, `section-y` |

  Adding a token is two lines: the value in `:root` and the mapping in `@theme inline`. Put the
  *reasoning* in a comment on the token (e.g. `--radius-field` is `--radius-panel` minus the `p-1`
  of its parent, so the corners stay concentric) — that is where the next person looks, not the JSX.

  Colors are defined ONCE via `light-dark(light, dark)` in `oklch` (no per-mode duplication, no
  `display-p3`); dark mode is bridged from the `.dark` class through `color-scheme`. Prefer solid
  state colors over `/opacity` on interactive elements.

  Spacing follows the Tailwind scale (`p-2`, `gap-1`, `min-h-19` — v4 generates any step), so
  `p-[7px]` is a defect too. Arbitrary values are acceptable only where no scale can apply, like a
  one-off `grid-rows-[0fr]` animation.
- Task tracking via **bd (beads)**, not markdown/TODO. Persistent knowledge via `bd remember`.
