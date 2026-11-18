# apps/web/src/components — app shell, shared state and root widgets

Repo-wide rules: `/RULES.md` (Frontend, Styling and tokens, Copy and i18n). Tokens, dark mode and
motion: `apps/web/src/CLAUDE.md`. Tests: `apps/web/CLAUDE.md`. Task writes: `hooks/CLAUDE.md`.

## Where code goes

- `ui/`: Radix/shadcn wrappers adapted to the DS (`ui/CLAUDE.md`). No app logic, no strings beyond
  `kit/copy.ts`.
- `kit/`: DS presentational primitives, props to markup (`kit/CLAUDE.md`). No `useDailify`,
  `useSession`, api or router hooks.
- Feature folders own their code and `copy.ts`: `dashboard/` (agenda, composer, sidebar), `auth/`,
  `landing/`, `mew/`, `mew-chat/`, and `pricing/` (covered below).
- Root, for what no single feature owns. Shell: `app-layout` (AppHeader, `dashboard/sidebar`,
  Outlet, Duplicates; no gutter on /dashboard), `app-header`, `protected-route`, `splash`,
  `scroll-restoration`, `error-boundary`, `brand`. State: `dailifyContext`, `theme-provider`. Task
  UI: `edit-task`, `task-card` (legacy desktop row, rendered by `dashboard/day-task-row` when not
  sheet-editing), `add-to-calendar`, `clock-check`, `duplicates-sheet`, `sync-badge`. Settings
  widgets for `pages/`: `hour-format-select`, `week-start-select`, `time-zone-select`,
  `mode-toggle.tsx:ThemeSelect`, `delete-account`, `integrations`,
  `settings-list.tsx:accountPage/accountGroups`.
- `dashboard/copy.ts` is the dictionary of the root components, `functions/` and `hooks/` too;
  `kit/`, `mew/` and `mew-chat/` have their own `copy.ts`.
- `landing/kit/` is the Mew speech kit the app imports, a legacy placement
  (`landing/CLAUDE.md`): never add app pieces there.

## DailifyContext (`dailifyContext.tsx:DailifyContextType`)

- `tasks`, `undatedTasks`: `undefined` until fetched or hydrated from the cache. `isLoading` is true
  while the boot's task load runs; load errors toast through `reportLoadError`.
- `loadedMonths`; `loadMonth(month)` waits on a loaded or in-flight month instead of refetching;
  `reloadMonths(months)` forces a refetch and returns the first error; `goToDay(day)` loads every
  month between today and `day`, then sets `selectedDay` and a fresh `targetDay`.
- `quotas`/`setQuotas`/`bumpUsage(key)` (optimistic +1). `invoices`/`paymentDetails`: only
  `pages/billing.tsx` loads or reads them.
- `weekStart`, `hour12`, `timeZone`/`setTimeZone`, which calls `setAppTimeZone`, clears
  `monthRequests` and refetches every loaded month by its mid-month date in the new zone.
- The provider sits above the Router (`App.tsx`): state survives route changes, and only a full page
  load resets it.
- `monthRequests`: a key stays while its month is loaded or in flight, a failed request removes
  itself, and a newer request for the same key turns older responses into no-ops (`isCurrent`).
  `reloadMonths` prunes tasks outside the map's months only when no request errored. Pinned by
  `dailifyContext.render.test.tsx`.
- `setTasks`/`setUndatedTasks` are the raw `useState` setters, typed `Dispatch<SetStateAction>`:
  after an await or from an Undo, update functionally.

## Boot: `protected-route.tsx`

It owns the task boot. Other code only re-triggers loads (`pages/integration-callback.tsx` calls
`reloadMonths` after an import), and page-specific data loads in its page (`pages/billing.tsx`).

- Session gate: a network/5xx get-session error falls back to `readLastUser()` and paints the cache;
  only a 401 or an empty session redirects to /login.
- Hydrates tasks and undated from the cache; writes the cache debounced (1s), flushed on `pagehide`
  and when the page goes hidden.
- `getTasks`: `flushQueue` first, then undated + settings, and `reloadMonths` for the loaded months,
  today, next month and `selectedDay`. After boot, a `selectedDay` in another month loads only it.
- Revalidates on `visibilitychange` at most every 30s and at once on `online`; both refetch quotas,
  which are keyed by today's month (`useNow("day")`).
- The splash holds for `SPLASH_MIN_MS` only when the route mounted while loading.
- `protected-route.render.test.tsx` pins loads-once, queue-before-undated, the deferred cache, the
  splash and the session fallback; extend it when the boot changes.

## Overlays and widgets

- Per-row overlay: `EditTask` wraps the Sheet; `EditTaskContent` mounts on first open and stays
  mounted for the exit animation, so a closed row pays for none of the sheet's hooks. Its save
  calls `updateTask` itself, against RULES.md "Frontend" (legacy: route new writes through
  `hooks/`).
- `Duplicates` shows at most once per app load (module `shown` flag), mounted once in `AppLayout`.
- View/container splits here: `DuplicatesSheet`, `CalendarRows`, `IntegrationCard` are the Views.
- New setting: a `UserSettings` field (shared `period.ts`) and its server side, a context field set in
  protected-route `loadUndated`, a widget that applies it, calls `saveSettings` and restores it with
  `toast.error` on failure (`week-start-select.tsx`), and a row in `pages/settings.tsx`.
- `theme-provider`: the key `vite-ui-theme` must match the pre-paint script in
  `apps/web/index.html`. The `transition:none` style injected on each switch is deliberate.

## pricing/

- `PlanCards` and `planFeatures(role)` derive bullets from `QUOTAS`: a limit of 0 gets no bullet,
  -1 the unlimited phrase. `currentPlan` is `string` on purpose: it is the session's free-text
  `user.plan` written by the Stripe webhook, and an unknown id just matches no card.
- Only `pages/premium.tsx` uses it; the landing forks it (`PricingV2`), so don't fork it again.

## Legacy: don't copy or import

- Settings rows are kit `ListGroup`/`ListRow`; `settings-list.tsx` keeps only the page widths.
- `ui/applePayLogo.tsx`, `ui/googlePayLogo.tsx` are brand art in `ui/`; new logos go in `logos.tsx`.
