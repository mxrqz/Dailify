# `src/types/` — shared type model

`types.ts` re-exports the canonical model from `@dailify/shared` (the model is owned there, not
here) plus the web-only picker prop interfaces. The invariants that aren't obvious from the types:

## `TaskProps` (= shared `Task`)

- **`date: number`**, `alert?: number`, `completed: number[]` — all epoch **milliseconds**, never a
  `Date`/`Timestamp` union. Wrap with `new Date(task.date)` when you need a JS `Date` for
  formatting/comparison; there is no `toJsDate()` anymore.
- **`repeat: Repeat`** (`"Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] }`, from
  `@dailify/shared`). The `Weekly` array holds weekday **names** (`"Monday"`…) matched via the
  `weekDays` index (`consts`). Untrusted `repeat` values (e.g. hand-built objects) should go through
  `normalizeRepeat` — but note the server already normalizes recurring/voice-created tasks before
  they reach the client, so the web app itself rarely needs to call it.

## Quotas — o contrato de tiering

Os limites e o uso vêm do servidor em `GET /permissions?month=YYYY-MM` e são lidos por `useQuotas()`.
Gate a UI em `states[key].blocked` / `.exhausted`, nunca no nome do plano. O registro é `QUOTAS`
(`@dailify/shared`), o mesmo import dos dois lados.

## Stripe shapes

`InvoicesProps` / `PaymentDetailsProps` (= shared `Invoice`/`PaymentDetails`) mirror what
`apps/server`'s billing routes send back from Stripe. Their `created`/`start` fields stay Stripe's
native **Unix seconds** (not epoch-ms like `Task`) — multiply by 1000 before formatting.

## When you change a type

Change it in `packages/shared/src/types.ts`, not here — `types.ts` just re-exports it. Update the
server (`apps/server`, same repo now) and the components that render it in the same change; both
sides import the identical type so drift shows up as a compile error instead of a runtime bug.
