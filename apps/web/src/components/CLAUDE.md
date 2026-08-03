# `src/components/` — React components

React 18 + Vite + TypeScript. App components live here at the top level; `ui/` holds shadcn
primitives (see `ui/CLAUDE.md`). `@/` resolves to `src/`.

## Shared state — `dailifyContext.tsx`

Single source of truth via `useDailify()`: `tasks`, `currentMonthTasks`, `selectedDay`,
`isCalendar`, `permissions`, `invoices`, `paymentDetails`, and their setters.

- **`protected-route.tsx`** is where it all loads: gates on Clerk (`isLoaded`/`userId`), then
  `getTasks()` (→ `getTasksForMonth`, `@/functions/api`) for the selected month, plus
  permissions/invoices/payment (also `api.ts`). It refetches when the month changes.
- **`daily-tasks.tsx`** derives `dayTasks` from `getTasksForDay(tasks, selectedDay)`. **`calendar-view.tsx`**
  reads `tasks` per day. Both read from the shared array — so any write must update it.

## Writes are optimistic against the shared array

On create/edit success: `setTasks(upsertTaskById(tasks ?? [], task))`. Complete/delete also update
`tasks` (and toast on failure — apply the optimistic change only after the server call succeeds).
There is **no** `newTask` mechanism anymore (it only mutated a local copy and desynced — removed in
`pz9.3`). If you add a write, surface it into `tasks`, not a component-local list.

## Dark mode & colors

- Dark mode is **class-based** (`.dark`) via `theme-provider.tsx` (custom `useTheme`, not
  next-themes). Tokens flip through a `color-scheme` bridge defined in `global.css`.
- Use semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-tag-N`,
  `bg-success`, …) — they already adapt to light/dark. Reach for the `dark:` variant only for the rare
  case a token can't express. **No hex / arbitrary colors.**
- Prefer solid state colors over `/opacity` on interactive elements (bd task `k00`).

## Misc

- `cn()` from `@/lib/utils` for conditional/merged classes.
- `edit-task.tsx` is a compound component (`EditTask` / `EditTaskTrigger` / `EditTaskContent`).
- Toasts via `sonner`. Navigate only to routes that exist (see `src/pages/CLAUDE.md`) — link to
  `/premium`, not `/prices`.
- `react-hooks/exhaustive-deps` is a warning here; several effects intentionally omit deps — think
  before "fixing" one (can cause refetch loops). See bd `0g7`.
