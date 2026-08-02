# `src/types/` — shared type model

`types.ts` holds the app-wide types. The invariants that aren't obvious from the types themselves:

## `TaskProps`

- **`date: Date | Timestamp`**, `alert?: Date | Timestamp`, `completed: Date[] | Timestamp[]`.
  The union is real: tasks fetched from Firestore carry `Timestamp`, optimistic/just-created tasks
  carry JS `Date`, and both live in the same `tasks` array. **Always** normalize with `toJsDate()`
  (`@/functions/functions`) before doing date math — never assume `.toDate()` exists.
- **`repeat: "Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] | undefined }`**. The
  `Weekly` array holds weekday **names** (`"Monday"`…) matched via the `weekDays` index (`consts`).
  For untrusted input (e.g. the voice API) run it through `normalizeRepeat()`.

## `PermissionsProps` — the tiering contract

Shape: `taskLimits.{daily,monthly,recurring}`, `features.voiceCreation`, `whatsapp.*`.
Gate features on **capabilities in this object**, never on the plan name string. `monthly === -1`
means unlimited. This is the source of truth the tiering epic (`d69`) builds on, and it must match
what the server returns.

## Stripe shapes

`InvoicesProps` / `PaymentDetailsProps` mirror what the server sends back from Stripe — change them
in lockstep with the server (separate repo).

## When you change a type

`TaskProps` especially ripples: update the Firestore read/expand (`functions/firebase.ts`), the pure
helpers (`functions/functions.ts`), the components that render it, **and the server repo** that writes
it. TypeScript won't catch the server drift.
