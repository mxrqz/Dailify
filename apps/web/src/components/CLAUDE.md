# `src/components/` — React components

React 18 + Vite + TypeScript. App components live here at the top level; `ui/` holds shadcn
primitives (see `ui/CLAUDE.md`). `@/` resolves to `src/`.

## Shared state — `dailifyContext.tsx`

Single source of truth via `useDailify()`: `tasks`, `selectedDay`, `targetDay`, `loadedMonths`,
`loadMonth`, `reloadMonths`, `goToDay`, `quotas`, `invoices`, `paymentDetails`, `undatedTasks`,
`weekStart`, and their setters. Keep per-frame UI state OUT of this context: every consumer
re-renders (the whole Home, measuring every swipe row) — the docked week strip flags
`data-strip-docked` on `<html>` instead, and `AppHeader` reacts with `in-data-strip-docked:`.

- **`protected-route.tsx`** is where it all loads: gates on Clerk (`isLoaded`/`userId`), then
  `getTasks()`: flushes the offline queue, then `reloadMonths` (context) for today, next month and
  every month already in `loadedMonths`. Each month is fetched (`getTasksForMonth`) and merged into
  `tasks` with `mergeMonth` — a month never replaces the others. `loadMonth(month)` adds one more
  month on demand, idempotent (loaded or in flight → no refetch). `goToDay(day)` loads every month
  between today and `day`, then sets `selectedDay` and `targetDay` (the list scrolls to it).
  Payment/invoices load once in the boot effect (keyed on `isLoaded`/`userId`; `getToken` and the
  setters are stable); quotas load in their own effect keyed by TODAY's month (`useNow`), not
  `selectedDay`'s. `protected-route.render.test.tsx` pins "loads once".
- **`dashboard/day-list.tsx`** is the continuous list: one `DaySection` per day with tasks (via
  `listDays`) up to the contiguous run of `loadedMonths`; a sentinel asks for the next month. The
  skeleton shows only at boot (`isLoading && !tasks`) — revalidation keeps the list and its scroll.
  `day-section.tsx`, `week-strip.tsx` read `tasks` per day with `getTasksForDay`. All read from the
  shared array — so any write must update it.

## Writes are optimistic against the shared array

On create and on EDIT: `upsertTaskWithRecurrence(tasks ?? [], task, loadedMonths)` — recurring
instances share the original's id, so `upsertTaskById` would swap only the first one and leave the
rest stale; it rebuilds the instances in every loaded month. Complete/delete/patch apply the
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
  `matchMedia`, que jsdom não tem e o app usa (motion, Radix, `useMediaQuery`).
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
- `react-hooks/exhaustive-deps` has 0 warnings — keep it so. An effect that must read a value
  without re-running on it calls a `useEffectEvent` (`hooks/useEffectEvent.ts`, the React 19.2 hook
  for React 18; the lint knows the name) instead of omitting the dep. Context functions like
  `loadMonth`/`reloadMonths` are new every render: in deps they'd refetch in a loop. See bd `0g7`.

## Motion

Estudo: `docs/research/2026-10-21-microanimacoes.md`. Valores sempre de `consts/motion.ts`.

- Anime pela frequência: o que se repete o dia todo (hover, atalho de teclado) é rápido ou não anima.
  Exceção: `n`/`/` abrem o composer com o morph, porque é o mesmo caminho do clique.
- CSS primeiro (hover, press, cor). `motion` para saída, layout, gesto e morph.
- Só `transform`/`opacity`; nunca `transition-all`. Exceções: largura da coluna lateral, o
  `grid-template-rows` do colapso e o `height` do preset `collapse` (saída de item de lista).
- Durações e curvas: utilitários `duration-fast|base|slow` e `ease-out|standard|exit` no CSS;
  `duration`, `ease`, `spring`, `fade`, `reveal`, `slideX`, `collapse` no motion. Sem bounce.
  `ease-out` sobrescreve a curva padrão do Tailwind. Landing: `ease.outExpo` e durações nomeadas
  em `landing/scenes/timing.ts`.
- Reduced motion: `<MotionConfig reducedMotion="user">` na raiz cobre transform e layout.
  `useReducedMotion` só onde há `duration` manual ou altura customizada.
  Exceção: `strokeDashoffset` do check-relógio (`duration` 0 com `useReducedMotion`).
