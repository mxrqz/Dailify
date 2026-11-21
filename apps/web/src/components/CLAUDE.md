# apps/web/src/components — app shell, shared state and root widgets

Repo-wide rules: `/RULES.md` (Frontend, Styling and tokens, Copy and i18n). Tokens, dark mode and
motion: `apps/web/src/CLAUDE.md`. Tests: `apps/web/CLAUDE.md`. Task writes: `hooks/CLAUDE.md`.

## Where code goes

- `ui/`: Radix/shadcn wrappers adapted to the DS (`ui/CLAUDE.md`). No app logic, no strings beyond
  `kit/copy.ts`.
- `kit/`: DS presentational primitives, props to markup (`kit/CLAUDE.md`). No `useDailify`,
  `useSession`, api or router hooks.
- Feature folders own their code and `copy.ts`: `dashboard/` (agenda, composer), `auth/`,
  `landing/`, `mew/`, `mew-chat/`, `onboarding/` (the first-run intro), and `nav/` and `pricing/`
  (covered below).
- Root, for what no single feature owns. Shell: `app-layout` (AppHeader, `nav/`,
  Outlet, Duplicates; no gutter on /dashboard; on mobile, account pages get `back-bar` instead of
  AppHeader, the legal pages' back + title bar), `app-header`, `protected-route`, `splash`,
  `scroll-restoration`, `error-boundary`, `brand`. State: `dailifyContext`, `theme-provider`. Task
  UI: `edit-task` (mobile sheet + `useTaskEditor`, also behind the desktop side panel),
  `add-to-calendar`, `duplicates-sheet`, `sync-badge`, `credits-tray`. Settings
  widgets for `pages/`: `hour-format-select`, `week-start-select`, `time-zone-select`,
  `theme-select`, `push-toggle`, `delete-account`, `integrations`,
  `settings-list.tsx:accountPage/accountGroups`.
- `dashboard/copy.ts` is the dictionary of the root components, `functions/` and `hooks/` too;
  `kit/`, `mew/` and `mew-chat/` have their own `copy.ts`.
- `logos/`: vendor brand SVGs (Google, Calendar, the landing's apps, the wallets), one file per
  family, all re-exported by `logos/index.ts`. A new logo goes there.

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
  and when the page goes hidden, which also refreshes the Android local alarms (`lib/reminders.ts`).
- `getTasks`: `flushQueue` first, then undated + settings, and `reloadMonths` for the loaded months,
  today, next month and `selectedDay`. After boot, a `selectedDay` in another month loads only it.
- Revalidates on `visibilitychange` at most every 30s and at once on `online`; both refetch quotas,
  which are keyed by today's month (`useNow("day")`).
- The splash holds for `SPLASH_MIN_MS` only when the route mounted while loading. On exit its Mew
  flies to `[data-slot="onboarding"] .mew` (the first-run intro) or else
  `[data-slot="create-dock"] .mew` (the mobile dock); neither, or reduced motion, it fades.
- `protected-route.render.test.tsx` pins loads-once, queue-before-undated, the deferred cache, the
  splash and the session fallback; extend it when the boot changes.

## Overlays and widgets

- Per-row overlay: `EditTask` wraps the Sheet; `EditTaskContent` mounts on first open and stays
  mounted for the exit animation, so a closed row pays for none of the sheet's hooks. Its logic is
  `useTaskEditor`, which the desktop panel reuses (`dashboard/CLAUDE.md`). Its save
  calls `updateTask` itself, against RULES.md "Frontend" (legacy: route new writes through
  `hooks/`).
- `Duplicates` shows at most once per app load (module `shown` flag), mounted once in `AppLayout`.
- View/container splits here: `DuplicatesSheet`, `CalendarRows`, `IntegrationCard` are the Views.
- New setting: a `UserSettings` field (shared `period.ts`) and its server side, a context field set in
  protected-route `loadUndated`, a widget that applies it, calls `saveSettings` and restores it with
  `toast.error` on failure (`week-start-select.tsx`), and a row in `pages/settings.tsx`.
- `theme-provider`: the key `vite-ui-theme` must match the pre-paint script in
  `apps/web/index.html`. The `transition:none` style injected on each switch is deliberate.

## nav/

- App-shell nav: `Sidebar` is mounted by `components/app-layout.tsx` (md+), `MobileNav` by
  `components/app-header.tsx` (below md, the glass drawer `Sheet side="left"`). On md+ there is no
  top bar: `AppHeader` is `md:hidden`, and each page's top is `Toolbar` (`app-header.tsx`, sticky,
  52px, SyncBadge first); `AppLayout` mounts an empty one, `/dashboard` its own with actions.
- Desktop: `SidebarMenu` (props) / `Sidebar` (wired): brand and history, Hoje (today's open count),
  Calendário (`?view=calendar`), "Conversar com a Mew" (`openPanel({ kind: "mew" })`), the "Conta"
  pages, then credits, "Assinar Pro" (Free) and the account `DropdownMenu` (Perfil, Segurança,
  Sair); signed out, "Entrar". Mobile: `NavMenu` (props, the `NAV_ITEMS` list) / `NavItems`. The
  meter (`CreditsMeter`) draws `QuotaState.ratio`. `/premium` shares the layout without
  `ProtectedRoute`, so account, credits and sign-out appear only when logged in.
- `SidebarItem` lights on path plus search (`to` may carry `?view=calendar`); an item with
  `onClick` is an action and never lights.
- The active item is neutral on purpose (brand would compete with the primary action), and nothing
  stays lit on mobile. `alsoActive="/premium"` lights "Planos" though it links to `/billing`.
- `MobileNav` closes only on a location change, adjusted during render (a link, even to the current
  route, and the device back); tapping the account or the meter leaves it open. Free users get the
  upsell in both (drawer "Assinar", sidebar "Assinar Pro"). The credits meter hides while quotas load or when AI is unlimited. Tests assert
  `aria-current="page"`.

## pricing/

- `PlanCards` and `planFeatures(role)` lead with the fixed unlimited-tasks bullet, then derive one
  per `QUOTAS` key: a limit of 0 gets no bullet, -1 the unlimited phrase. `currentPlan` is `string` on purpose: it is the session's free-text
  `user.plan` written by the Stripe webhook, and an unknown id just matches no card.
- Only `pages/premium.tsx` uses it; the landing forks it (`landing/sections/pricing`), so don't fork it again.

## Legacy: don't copy or import

- Settings rows are kit `ListGroup`/`ListRow`; `settings-list.tsx` keeps only the page widths.
