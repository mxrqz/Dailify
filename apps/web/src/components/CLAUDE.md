# `src/components/` — React components

React 18 + Vite + TypeScript. App components live here at the top level; `ui/` holds shadcn
primitives (see `ui/CLAUDE.md`). `@/` resolves to `src/`.

## Kit do redesign mobile — `kit/`

Peças apresentacionais (props → markup, sem `useDailify`/Clerk): o container busca os dados e passa.
Toda string visível vem de `copy` (os defaults "Fechar"/"Cancelar"/"Remover" estão em `copy.kit`).

- `ListGroup({ title?, footer?, compact? })` e `ListRow({ icon?, label, sublabel?, value?, trailing?, below?, accessory?, danger?, href?, onClick?, asChild? })`
  — lista agrupada do iOS. A linha vira `<a>` com `href`, `<button>` com `onClick` (funciona sob
  um `DialogTrigger asChild`), `<div>` sem nenhum; `asChild` pra um `<Link>`. `accessory` é
  `"chevron"` ou `"external"`. Separador só entre linhas. `compact` é o grupo de dentro de folha
  (raio 14, linhas de 48). Espaço entre grupos é de quem usa (`gap-7`).
- `SegmentedControl({ value, onValueChange, options, aria-label })` — radiogroup em cápsula, thumb
  `ink`; já ignora o `""` do Radix. `className="w-32 flex-none"` pra versão estreita ao lado do rótulo.
- `Switch({ checked, onCheckedChange, aria-label })` — `role="switch"`, `ink` ligado.
- `Chip({ icon?, variant?: "action" | "select", size?: "default" | "sm", pressed?, onRemove? })` —
  raio 10 pra ação/toggle, cápsula (`select`) só pra escolha; ref/props vão pro botão principal.
- `PageHeader({ title, subtitle?, bar?, trailing? })` — barra de material sticky + Large Title.
- `ProgressRing({ value, max, label })` — anel de 40px com "feitas/total".
- `ActionSheet({ open, onOpenChange, title, description?, actions, cancelLabel? })` — pergunta do
  iOS (opções + Cancelar em vidro). `RecurrenceScopeDialog` já usa.
- `Refraction({ strength?, edge? })` — montado uma vez no `App`: o `<filter id="refract">` (fundo
  escorrega pra fora a ~3×`edge` px das bordas, com franja RGB) e `<html class="refract">` só no
  Chromium. `glass` e `dock-veil` já usam via `var(--refract,)`; fora do Chromium ou com movimento/
  transparência reduzidos fica vazio e o vidro é o de sempre.
- `Button` (`ui/button`): `default` (brand), `secondary` (fill), `ghost`, `soft-danger` (brand-soft +
  brand-text, o "Encerrar"), `link`; `outline` é legado. Tamanhos `sm` 32 / `default` 44 / `lg` 52 /
  `icon` 44, raio pela altura.

**Superfícies** (utilities do `global.css`): `card` = surface + contorno de 1px (`--card-edge`);
`glass` = vidro de overlay (sheet, gaveta, sidebar, dialog, action sheet — popover não); `scrim` =
fundo atrás do overlay. Dentro do `glass`, `fill`/`fill-pressed`/`surface` sobem um tom sozinhos.
Regras do vidro: nenhum ancestral com `opacity<1`/`filter`/`mask`/`mix-blend-mode` (o fade de um
wrapper do `AnimatePresence` mata o blur: anime o próprio painel), só transform/opacity, no máximo
duas camadas, e sem `overflow-hidden` no próprio vidro (corta o fio de luz do topo; role um filho).
`Sheet side="bottom"` (topo de 32px + puxador) e `side="left"` (gaveta de 304px) e `DialogContent`
já são vidro sobre scrim — não passe `bg-*`/`border-*` pra eles. Texto: `text-title-1` (34),
`text-title-3` (22), `text-body` (17), `text-subhead` (15), `text-footnote` (13), `text-xs` (12).

Conferir visualmente sem dev server: o harness de preview (`SCRATCH/preview/README.md` do
orquestrador) builda stories e tira screenshot a 390px nos dois temas.

## Shared state — `dailifyContext.tsx`

Single source of truth via `useDailify()`: `tasks`, `selectedDay`, `targetDay`, `loadedMonths`,
`loadMonth`, `reloadMonths`, `goToDay`, `quotas`, `invoices`, `paymentDetails`, `undatedTasks`,
`weekStart`, and their setters. Keep per-frame UI state OUT of this context: every consumer
re-renders (the whole Home, measuring every swipe row).

- **`protected-route.tsx`** is where it all loads: gates on Clerk (`isLoaded`/`userId`), then
  `getTasks()`: flushes the offline queue, then `reloadMonths` (context) for today, next month and
  every month already in `loadedMonths`. Each month is fetched (`getTasksForMonth`) and merged into
  `tasks` with `mergeMonth` — a month never replaces the others. `loadMonth(month)` adds one more
  month on demand, idempotent (loaded or in flight → no refetch). `goToDay(day)` loads every month
  between today and `day`, then sets `selectedDay` and `targetDay` (the list scrolls to it).
  Payment/invoices are NOT loaded here — `pages/billing.tsx` fetches them on open into the context
  setters. The tasks cache is written debounced, flushed on `pagehide`/hidden. Quotas load in their own effect keyed by TODAY's month (`useNow`), not
  `selectedDay`'s. `protected-route.render.test.tsx` pins "loads once".
- **`dashboard/day-list.tsx`** is the continuous list: one `DaySection` per day with tasks (via
  `listDays`) up to the contiguous run of `loadedMonths`; a sentinel asks for the next month. The
  skeleton shows only at boot (`isLoading && !tasks`) — revalidation keeps the list and its scroll.
  `day-section.tsx`, `week-strip.tsx`, `month-calendar.tsx` read `tasks` per day with
  `getTasksForDay`. Each splits a presentational piece (props → markup, for the preview harness)
  from the container: `WeekDays`/`WeekStrip`, `MonthGrid`/`MonthCalendar`, `TaskRow`/`DayTaskRow`
  (touch only — desktop keeps `TaskCard` with chip editing), `AnytimeCard`+`AnytimeItem`/`AnytimeBlock`.
  The month opens from the bar's calendar icon as `/dashboard?view=calendar` (device back closes
  it). All read from the shared array — so any write must update it.

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
