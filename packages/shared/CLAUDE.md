# `packages/shared` — the canonical model (`@dailify/shared`)

The single source of truth for the shapes both `apps/web` and `apps/server` import. If a type lives
here, change it **here** — both sides import the same symbol, so drift becomes a compile error
instead of a runtime bug. **One runtime dep: `@date-fns/tz`** (só `Intl`, roda no Worker), pro
parser. Consumed as TS source (`exports` → `./src/index.ts`, no build step); keep it isomorphic
(no Node, no DOM, no `fetch`).

## What's here (`src/`, all re-exported via `index.ts`)

- **`types.ts`** — `Task`/`TaskInput`, `Repeat`, `Role`, Stripe `Invoice`/`PaymentDetails`.
- **`pricing.ts`** — plan pricing only: `PlanRole`, `PLAN_PRICING`, `PRICING_CURRENCY`,
  `formatPrice`, `yearlySavings`.
- **`quotas.ts`** — `QUOTAS` (o registro), `limitsFor`, `quotaState`, `computeQuotas`.
- **`recurrence.ts`** — `expandRecurringTask`, `normalizeRepeat`.
- **`dates.ts`** — epoch-ms month helpers (`startOfMonthMs`, `endOfMonthMs`, …).
- **`parse-task/`** + **`parse-links.ts`** — o parser local de frases (`parseTaskText(input, now,
  { ignore })`), usado pelo composer do web e pela voz do servidor. `globals.d.ts` declara o pouco
  de host que ele usa (`URL`, `console`) sem puxar o lib DOM.

## Invariants that bite if ignored

- **`Task` dates are epoch-ms `number`s** (`date`, `alert?`, `completed: number[]`) — never
  `Date`/`Timestamp`. Stripe shapes (`Invoice`/`PaymentDetails`) keep Stripe's native **Unix
  seconds** — different unit, `*1000` before formatting.
- **Quota é declarada uma vez, em `QUOTAS`.** `limitsFor(role)` → `{ tasks, ai }`;
  **`-1` = ilimitado, `0` = bloqueado**. Servidor e web iteram `QUOTA_KEYS` — nunca nomeiam quota a
  quota, e nunca decidem pela string do plano. Quota nova sem contador (servidor) ou sem rótulo
  (web) é erro de compilação.
- **`computeQuotas(undefined, …)`** = ainda carregando: tudo conta como ilimitado, então a UI se
  esconde pelo `loading` e a criação não trava. Vale porque nenhum plano tem limite `0`; se algum
  voltar a ter, o default precisa voltar a ser por quota.
- **Parser: fuso explícito, sem estado de módulo.** `now` é um `TZDate` e toda data do parser
  descende dele (`dateIn`/`zoneOf` em `vocab.ts`); data sem fuso lança. Um fuso global seria
  sobrescrito por requisições concorrentes no Worker. Web passa `zoned()`, servidor
  `new TZDate(Date.now(), tz)`.
- **`repeatEvery` (N) conta da `date` da tarefa** em dias/meses/anos civis: semanal a cada N =
  blocos de 7 dias a partir da `date` (não do `weekStart`); mensal no 31 corta pro fim do mês sem
  arrastar a âncora. `taskHash` só inclui o campo quando não é 1 — hash antigo não muda.
- **Recurrence is owned here.** The server expands instances in `GET /tasks`; the web renders what
  it receives. Feed untrusted `repeat` through `normalizeRepeat`.

## Tests

`bun run test` (or `bun --filter @dailify/shared test`) — vitest, colocated `*.test.ts`. Pricing's
pure helpers (`formatPrice`, `yearlySavings`) and recurrence are fully tested; the quota registry
has its own suite in `quotas.test.ts`. Keep new logic pure and add a test. No `as`; see root
`CLAUDE.md`.

**Golden do parser:** `parse-task.corpus.ts` + `parse-task.corpus/` (formato em `kit.ts`), catraca em
`parse-task.corpus.test.ts` contra `parse-task.known-failures.ts`. O fuso é fixo no `kit.ts`
(`CORPUS_ZONE`), então passa igual sob qualquer `TZ`. Depois de mexer no parser:
`bun run parser:failures` (aqui) regera a lista e grita `REGRESSÃO` pra falha nova.
