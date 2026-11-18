# apps/web/src/types — legacy type aliases

Repo-wide rules: [/RULES.md](../../../../RULES.md). The model is owned by `@dailify/shared`.

- `types.ts` only renames shared types (`TaskProps` = `Task`, `InvoicesProps` = `Invoice`,
  `PaymentDetailsProps` = `PaymentDetails`) plus `FormDataValues`, which nothing imports.
- New code imports `Task`/`Invoice`/`PaymentDetails` from `@dailify/shared` and adds nothing here.
  Move a file off the aliases when you touch it; the folder goes once none are left.
- Wire response types belong in `@dailify/shared`, not here or in `functions/api.ts`
  ([RULES.md, TypeScript](../../../../RULES.md#typescript)).
- Stripe `Invoice.created` and `PaymentDetails.start` are Unix **seconds**, unlike the epoch-ms
  `Task` dates: convert with `zoned(x * 1000)`, as `pages/billing.tsx` does.
- `Repeat`'s `{ Weekly: string[] }` holds English weekday names; order and index come from
  `weekDays`/`dayMap` in `@dailify/shared`.
