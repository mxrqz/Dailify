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
bun run lint          # eslint
bun run format        # prettier --write src
bun run check         # format:check + lint + typecheck + test (full gate)
```

## Architecture Overview

See `bd memories architecture`. In short: web app on Vercel (dailify.mxrqz.com) inside a
vestigial Tauri shell. Auth = Clerk. Reads/deletes go client→Firestore via a Clerk→Firebase
custom-token bridge (`protected-route.tsx`); creates/edits/voice/billing go through an external
Node server on Render (separate repo) running Stripe. Plans: Free / Pro / Pro+AI.

## Conventions & Patterns

- **No `as` type assertions.** Use type guards or proper types. `as const` is fine. Enforced as
  an ESLint *warning* while the ~50 existing ones are cleaned up gradually (bd issue `aqa`).
- **Formatting: Prettier** (`.prettierrc`, `printWidth: 100`). Run `bun run format` before
  committing; `bun run check` is the full gate (format + lint + typecheck + test).
- **Design tokens** live in `src/global.css`. Colors are defined ONCE via `light-dark(light, dark)`
  in `oklch` (no per-mode duplication, no `display-p3`); dark mode is bridged from the `.dark`
  class through `color-scheme`. No hex/arbitrary colors in components — add a token + a
  `@theme inline` mapping. Prefer solid state colors over `/opacity` on interactive elements.
- Task tracking via **bd (beads)**, not markdown/TODO. Persistent knowledge via `bd remember`.
