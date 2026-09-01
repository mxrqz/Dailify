# `packages/shared` — the canonical model (`@dailify/shared`)

The single source of truth for the shapes both `apps/web` and `apps/server` import. If a type lives
here, change it **here** — both sides import the same symbol, so drift becomes a compile error
instead of a runtime bug. **Zero runtime deps.** Consumed as TS source (`exports` → `./src/index.ts`,
no build step); keep it isomorphic (no Node, no DOM, no `fetch`).

## What's here (`src/`, all re-exported via `index.ts`)

- **`types.ts`** — `Task`/`TaskInput`, `Repeat`, `Role`, Stripe `Invoice`/`PaymentDetails`.
- **`pricing.ts`** — plan pricing only: `PlanRole`, `PLAN_PRICING`, `PRICING_CURRENCY`,
  `formatPrice`, `yearlySavings`.
- **`quotas.ts`** — `QUOTAS` (o registro), `limitsFor`, `quotaState`, `computeQuotas`.
- **`recurrence.ts`** — `expandRecurringTask`, `normalizeRepeat`.
- **`dates.ts`** — epoch-ms month helpers (`startOfMonthMs`, `endOfMonthMs`, …).

## Invariants that bite if ignored

- **`Task` dates are epoch-ms `number`s** (`date`, `alert?`, `completed: number[]`) — never
  `Date`/`Timestamp`. Stripe shapes (`Invoice`/`PaymentDetails`) keep Stripe's native **Unix
  seconds** — different unit, `*1000` before formatting.
- **Quota é declarada uma vez, em `QUOTAS`.** `limitsFor(role)` → `{ tasks, recurring, voice }`;
  **`-1` = ilimitado, `0` = bloqueado**. Servidor e web iteram `QUOTA_KEYS` — nunca nomeiam quota a
  quota, e nunca decidem pela string do plano. Quota nova sem contador (servidor) ou sem rótulo
  (web) é erro de compilação.
- **`computeQuotas(undefined, …)`** = ainda carregando: tudo conta como ilimitado, então a UI se
  esconde pelo `loading` e a criação não trava. Vale porque nenhum plano tem limite `0`; se algum
  voltar a ter, o default precisa voltar a ser por quota.
- **Recurrence is owned here.** The server expands instances in `GET /tasks`; the web renders what
  it receives. Feed untrusted `repeat` through `normalizeRepeat`.

## Tests

`bun run test` (or `bun --filter @dailify/shared test`) — vitest, colocated `*.test.ts`. Pricing and
recurrence are pure and fully tested; keep new logic pure and add a test. No `as`; see root `CLAUDE.md`.
