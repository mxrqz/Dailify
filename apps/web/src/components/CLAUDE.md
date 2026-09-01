# `src/components/` — React components

React 18 + Vite + TypeScript. App components live here at the top level; `ui/` holds shadcn
primitives (see `ui/CLAUDE.md`). `@/` resolves to `src/`.

## Shared state — `dailifyContext.tsx`

Single source of truth via `useDailify()`: `tasks`, `currentMonthTasks`, `selectedDay`,
`isCalendar`, `quotas`, `invoices`, `paymentDetails`, and their setters.

- **`protected-route.tsx`** is where it all loads: gates on Clerk (`isLoaded`/`userId`), then
  `getTasks()` (→ `getTasksForMonth`, `@/functions/api`) for the selected month. Payment/invoices
  load once in the boot effect (deps `[isLoaded, userId]`); quotas load in their own effect keyed
  by month (`quotaMonth`) — only that fetch refires when the month changes.
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
(`hooks/useTaskActions.tsx`) — waiting for the round-trip made every tap feel dead on mobile. Delete
also offers "Desfazer" in the toast, which recreates the task with the same id.
Numa tarefa **recorrente**, excluir e editar primeiro perguntam o escopo: o hook devolve
`deleteDialog` (por isso ele é `.tsx`) e quem o usa renderiza — "só esta ocorrência" manda
`?occurrence=` e a data entra no `exdates` da série, sem apagar nada. Essa exclusão não tem
"Desfazer": não há rota que tire uma data do `exdates`.
The day view's write path is **`dashboard/day-task-row.tsx`** for complete/delete actions.
There is **no** `newTask` mechanism anymore (it only mutated a local copy and desynced — removed in
`pz9.3`). If you add a write, surface it into `tasks`, not a component-local list.

## Auth — `auth/`

`/login` and `/signup` are the same machine, differing only in copy: both mount `auth-page.tsx`
with a `mode` ("signIn" | "signUp").

- **`auth-state.ts` is the only place logic goes**, and the tested file of the folder
  (`auth-state.test.ts`). `use-email-link-auth.ts` is just the wire to Clerk: if you're
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

## Testes de render

Componente com estado condicional **tem** teste de render (bd `040`): `/billing` já apareceu em
branco para todo usuário Free, e depois anunciou "ilimitado" para quem tinha 30/mês — os dois
passariam por qualquer suíte de função pura.

- Arquivo `*.render.test.tsx` com `/** @vitest-environment jsdom */` na primeira linha. O default do
  projeto é `node` (a maioria dos testes é de lógica pura e não paga o custo do DOM), e
  `environmentMatchGlobs` não existe mais no vitest 4.
- `src/test/setup.ts` faz `cleanup` entre testes e stuba `IntersectionObserver` / `ResizeObserver` /
  `matchMedia`, que jsdom não tem e o app usa (framer-motion, Radix, `useMediaQuery`).
- Mocke `@clerk/clerk-react` e `useDailify` por arquivo — montar os providers de verdade traria
  rede e sessão para dentro do teste. Envolva em `MemoryRouter` quem usa rota.
- Prefira o contrato acessível ao detalhe visual: `aria-current="page"` para item de navegação
  aceso, `getByRole("heading")` para título. E cuidado com escopo: a `/billing` mostra a tabela de
  planos junto, então "Tarefas ilimitadas" existe na página mesmo para o Free — use `within()`.

## Misc

- `cn()` from `@/lib/utils` for conditional/merged classes.
- `edit-task.tsx` is a compound component (`EditTask` / `EditTaskTrigger` / `EditTaskContent`).
- Toasts via `sonner`. Navigate only to routes that exist (see `src/pages/CLAUDE.md`) — link to
  `/premium`, not `/prices`.
- `react-hooks/exhaustive-deps` is a warning here; several effects intentionally omit deps — think
  before "fixing" one (can cause refetch loops). See bd `0g7`.
