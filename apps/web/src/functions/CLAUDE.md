# apps/web/src/functions — data layer and pure web helpers

Repo-wide rules: [/RULES.md](../../../../RULES.md); what belongs here versus `lib/` or shared is
in [Where code goes](../../../../RULES.md#where-code-goes). Only local invariants follow.

## Modules

Each has a colocated `<module>.test.ts`, except `api.ts` and `push.ts`.

- `api.ts`: the only HTTP boundary to `apps/server`. `push.ts`: Web Push for this device.
- `offline.ts`: per-user cache, outbox queue, last signed-in user, `newTaskId`, `clearLocal`.
- `zone.ts`: the app zone as module state (`appTimeZone`/`setAppTimeZone`, `zoned`, `zonedAt`,
  `fromDateInput`), so the parser, the queue and the API read one zone.
- `functions.ts`: legacy grab-bag (`fill`, `formatClock`, `getTasksForDay`,
  `upsertTaskWithRecurrence`, `mergeMonth`, ...). No new exports; a new helper gets its own module.
- One concept each: `repeat-label`, `link-label`, `quota-label`, `undated`, `user-agent`,
  `compose-input` (composer chip state: `onDay`, `fromWire`, `markSegments`, `withEdits`; not
  shared's `composeTaskInput`), `edit-input` (edit form to `TaskInput`), `billing-sections`,
  `revert-task`.
- Imports: shared, date libs, `@/consts`, `@/lib`, siblings, `components/*/copy.ts`, `import type`
  from components. `@/types` is a legacy alias layer; new code imports `@dailify/shared`.
- A `month: Date` parameter (`getTasksForMonth`, `getQuotas`, `mergeMonth`, the `months` of
  `upsertTaskWithRecurrence`) must be a zoned month: its year and month are read in its own zone.

## api.ts contract

- Every endpoint wraps the private `request<T>()`, which never throws: a rejected fetch gives
  `{ offline: true }`, a non-2xx `{ status, code, message }`, a non-JSON body (a Worker 502 is HTML)
  `undefined`. Endpoints return `{ <noun>?: T; error?: ApiError }`; `message` is for a toast only.
- A 401 also fires `authClient.$store.notify("$sessionSignal")`, so the session gate re-reads.
  `errorBody` is a failed response's body: `createCalendarEvent` reads a 409 `already_linked`
  from it.
- Auth is `credentials: "include"` (web cookie) plus `authHeaders()` (Tauri bearer); no function
  takes a token. In PATCH bodies `null` clears and an absent key keeps (`updateTask`'s `alert`).
- Legacy, don't copy: `createTaskVoice` (FormData; `authed()` forces JSON Content-Type) and the push
  trio call `fetch` directly, so push throws offline and voice errors lack `status`/`code`.
  `getQuotas`, `getPaymentDetails`, `getInvoices`, `checkout`, `billingPortal` drop `error`. The
  `/tasks/${id}` routes skip `encodeURIComponent`.

Adding an endpoint: name the wire type in `@dailify/shared`
([TypeScript](../../../../RULES.md#typescript)); wrap `request<T>()` here and `encodeURIComponent`
every path segment; add the function to the `vi.mock("@/functions/api", () => api)` object of each
render test whose component now calls it (a factory mock throws on an export it lacks). api.ts
itself is testable with `vi.stubGlobal("fetch", ...)` plus `vi.mock("@/lib/auth")`.

## Offline queue (`offline.ts`)

- `Mutation` replays existing routes: `create` (id from `newTaskId()`, which survives a missing
  `crypto.randomUUID` on plain http), `patch` (optional `occurrence`), `complete`, `uncomplete`
  (`day`, or `[day, until]` for an undated period), `delete`, `delete-occurrence`.
- `collapseQueue`: a `delete` drops its task's pending entries, and itself when a `create` was
  pending. The newest `complete`/`uncomplete` replaces the pending one whatever its day. Patches
  merge per (task, occurrence); a series patch on a pending `create` folds into it.
  `delete-occurrence` is its own op so it never collapses like a delete.
- `flushQueue` is single-flight per user (`flushing` map). The drain re-reads storage every step,
  stops at the first offline or 401 (kept for the next sign-in) and drops what the server refused.
  Entries are removed by value, not index: another tab may have sent the head meanwhile.
- `enqueue` doesn't collapse during a flush: a delete folded into an in-flight create is lost.
- `drainQueue` holds one of the five copies of the settle predicate (`hooks/CLAUDE.md`).
- Storage keys are a persisted contract (renaming drops queued writes):
  `dailify:{tasks,outbox,undated}:<userId>`, `dailify:last-user`, `mewki:mew:<userId>:v1`
  (`chatKey`, read by `components/mew-chat/thread.ts`); `clearLocal` removes all but device-wide ones
  ([Security](../../../../RULES.md#security-and-privacy)).

## Lists

- `upsertTaskWithRecurrence` replaces every entry with the task's id and re-expands it per loaded
  month (instances share the series id; the server expands only on GET). It expands from
  `seriesOf(task)`, so an instance is safe; a series date change must arrive as a shifted anchor.
- `revertTask(current, previous, id)`: a rollback that resets only `id` to its `previous` entries.
- `getTasksForDay` memoizes per tasks array and zone in a `WeakMap` and returns shared buckets:
  never mutate them or the tasks array; `setTasks` always gets a new array.

## Copy and tests

- Helpers read pt-BR from `@/components/dashboard/copy`. The `.replace` chains in `repeat-label` and
  `quota-label` and the api.ts fallback messages are legacy
  ([Copy](../../../../RULES.md#copy-and-i18n)).
- Harness and jsdom opt-in: `apps/web/CLAUDE.md`. A module that calls the API mocks `./api` through
  `vi.hoisted`, as `offline.test.ts` does.
