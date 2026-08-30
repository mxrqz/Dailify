# `src/components/` — React components

React 18 + Vite + TypeScript. App components live here at the top level; `ui/` holds shadcn
primitives (see `ui/CLAUDE.md`). `@/` resolves to `src/`.

## Shared state — `dailifyContext.tsx`

Single source of truth via `useDailify()`: `tasks`, `currentMonthTasks`, `selectedDay`,
`isCalendar`, `permissions`, `invoices`, `paymentDetails`, and their setters.

- **`protected-route.tsx`** is where it all loads: gates on Clerk (`isLoaded`/`userId`), then
  `getTasks()` (→ `getTasksForMonth`, `@/functions/api`) for the selected month, plus
  permissions/invoices/payment (also `api.ts`). It refetches when the month changes.
- **`dashboard/day-view.tsx`** derives `dayTasks` from `getTasksForDay(tasks, selectedDay)` then
  `groupTasksByTime`. (The two-column day+aside layout lives one level up, in `pages/home.tsx`, which
  mounts `DayView` beside `DayAside`.) **`dashboard/month-view.tsx`** (grid chrome) and
  **`dashboard/month-day-cell.tsx`** (cell + day sheet, mounting `DayTaskRow`) read `tasks` per day
  the same way. All three read from the shared array — so any write must update it.

## Writes are optimistic against the shared array

On create success: `setTasks(upsertTaskById(tasks ?? [], task))`. On EDIT, use
`upsertTaskWithRecurrence(tasks ?? [], task, selectedDay)` — recurring instances share the original's
id, so `upsertTaskById` would swap only the first one and leave the rest stale. Complete/delete/patch apply the
change to `tasks` **immediately**, keep the previous array, and restore it if the server refuses
(`hooks/useTaskActions.ts`) — waiting for the round-trip made every tap feel dead on mobile. Delete
also offers "Desfazer" in the toast, which recreates the task with the same id.
The day view's write path is **`dashboard/day-task-row.tsx`** for complete/delete actions.
There is **no** `newTask` mechanism anymore (it only mutated a local copy and desynced — removed in
`pz9.3`). If you add a write, surface it into `tasks`, not a component-local list.

## Auth — `auth/`

`/login` and `/signup` are the same machine, differing only in copy: both mount `auth-page.tsx`
with a `mode` ("signIn" | "signUp").

- **`auth-state.ts` is the only place logic goes**, and the only tested file of the folder
  (`auth-state.test.ts`) — the repo has no jsdom or `@testing-library/react`, so anything worth a
  test has to be a pure function. `use-email-link-auth.ts` is just the wire to Clerk: if you're
  writing an `if` that isn't about Clerk's API, it belongs in the reducer.
- Every visible string comes from `auth/copy.ts` (pt-BR) — no literals in JSX.
- `auth-shell.tsx` owns the whole layout; the body components are `email-form.tsx` and
  `check-inbox.tsx`. `/verify` reuses the shell with all its props omitted.

## Dark mode & colors

- Dark mode is **class-based** (`.dark`) via `theme-provider.tsx` (custom `useTheme`, not
  next-themes). Tokens flip through a `color-scheme` bridge defined in `global.css`.
- Use semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-tag-N`,
  `bg-success`, …) — they already adapt to light/dark. Reach for the `dark:` variant only for the rare
  case a token can't express. **No hex / arbitrary colors.**
- The same rule covers **radii**: `rounded-panel` / `rounded-field` / `rounded-md`, never
  `rounded-[17px]`. Tokens are in `global.css` (`:root` + `@theme inline`); if none fits, add one
  instead of inlining a pixel value. See the token table in the root `CLAUDE.md`.
- Prefer solid state colors over `/opacity` on interactive elements (bd task `k00`).

## Misc

- `cn()` from `@/lib/utils` for conditional/merged classes.
- `edit-task.tsx` is a compound component (`EditTask` / `EditTaskTrigger` / `EditTaskContent`).
- Toasts via `sonner`. Navigate only to routes that exist (see `src/pages/CLAUDE.md`) — link to
  `/premium`, not `/prices`.
- `react-hooks/exhaustive-deps` is a warning here; several effects intentionally omit deps — think
  before "fixing" one (can cause refetch loops). See bd `0g7`.
