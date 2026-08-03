# `packages/shared` — the canonical model (`@dailify/shared`)

The single source of truth for the shapes both `apps/web` and `apps/server` import. If a type lives
here, change it **here** — both sides import the same symbol, so drift becomes a compile error
instead of a runtime bug. **Zero runtime deps.** Consumed as TS source (`exports` → `./src/index.ts`,
no build step); keep it isomorphic (no Node, no DOM, no `fetch`).

## What's here (`src/`, all re-exported via `index.ts`)

- **`types.ts`** — `Task`/`TaskInput`, `Repeat`, `Role`, `Permissions`, `Entitlements`, Stripe
  `Invoice`/`PaymentDetails`.
- **`pricing.ts`** — `PLAN_PERMISSIONS` (the tier table) + `computeEntitlements`.
- **`recurrence.ts`** — `expandRecurringTask`, `normalizeRepeat`.
- **`dates.ts`** — epoch-ms month helpers (`startOfMonthMs`, `endOfMonthMs`, …).

## Invariants that bite if ignored

- **`Task` dates are epoch-ms `number`s** (`date`, `alert?`, `completed: number[]`) — never
  `Date`/`Timestamp`. Stripe shapes (`Invoice`/`PaymentDetails`) keep Stripe's native **Unix
  seconds** — different unit, `*1000` before formatting.
- **Tiering is capability-based.** `PLAN_PERMISSIONS[role]` → `{ taskLimits: {monthly, recurring},
  features: {voiceCreation} }`; **`-1` = unlimited**, `recurring: 0` = not allowed. Gate on these
  numbers, never on the role string. This table is what `apps/server` enforces and what the web
  reads — one import, both sides.
- **`computeEntitlements(undefined, …)`** = permissions not loaded: premium features default OFF
  (no flash) but `canCreateTask` stays true (don't lock out a paying user mid-load).
- **Recurrence is owned here.** The server expands instances in `GET /tasks`; the web renders what
  it receives. Feed untrusted `repeat` through `normalizeRepeat`.

## Tests

`bun run test` (or `bun --filter @dailify/shared test`) — vitest, colocated `*.test.ts`. Pricing and
recurrence are pure and fully tested; keep new logic pure and add a test. No `as`; see root `CLAUDE.md`.
