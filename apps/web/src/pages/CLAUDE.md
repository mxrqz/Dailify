# apps/web/src/pages — routes and page containers

One file per route. `src/App.tsx` declares the routes; each page owns its own I/O. Repo-wide rules:
[/RULES.md](../../../../RULES.md).

## App.tsx

- Providers, outermost first: `HelmetProvider` > `DailifyProvider` > `BrowserRouter` >
  `ThemeProvider` > `TooltipProvider` > `MotionConfig reducedMotion="user"` > `ErrorBoundary` >
  `Suspense fallback={null}`. `ScrollRestoration`, `Toaster` and `Refraction` sit beside the
  boundary. `main.tsx` only boots.
- Every page is a `lazy()` chunk except `home.tsx`, the PWA `start_url` (`/dashboard`).
- Protected routes nest under one layout route, `<ProtectedRoute><Outlet /></ProtectedRoute>`,
  which gates on the session and boots the task data before rendering (`components/CLAUDE.md`,
  "Boot").
- `*` redirects to `/dashboard`, so a mistyped link fails silently. Link only to paths in this table
  (`/premium`, never `/prices`).

| Path                                                  | Page                                           | Layout and access                                                                                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                   | `landingPage.tsx`                              | public; in Tauri a `Navigate` to `/dashboard` (no landing)                                                                                                                      |
| `/dashboard`                                          | `home.tsx`                                     | AppLayout, protected; `?view=calendar` opens the month, `?at=<epoch-ms>` (Android reminder tap) goes to that day, `?mew=voice` (Android assistant) opens the composer listening |
| `/profile`, `/settings`, `/security`, `/integrations` | same names                                     | AppLayout, protected; account pages                                                                                                                                             |
| `/billing`                                            | `billing.tsx`                                  | AppLayout, protected                                                                                                                                                            |
| `/integrations/:provider/callback`                    | `integration-callback.tsx`                     | AppLayout, protected; the OAuth `redirect_uri`                                                                                                                                  |
| `/premium`                                            | `premium.tsx`                                  | AppLayout, **public** on purpose: it is the sales page                                                                                                                          |
| `/login`, `/signup`                                   | `login.tsx`, `signup.tsx`                      | public; `AuthPage mode` (`components/auth/CLAUDE.md`)                                                                                                                           |
| `/verify`, `/auth/app`, `/app/*`                      | `verify.tsx`, `auth-app.tsx`, `app-return.tsx` | public hand-off pages (below)                                                                                                                                                   |
| `/privacidade`, `/termos`                             | `privacy.tsx`, `terms.tsx`                     | public; `components/legal-page.tsx`                                                                                                                                             |

## Adding a page

1. `lazy(() => import("./pages/<kebab-name>"))`, then a `Route` inside `<AppLayout>` (top bar and
   sidebar) or outside it (full screen). Nest it under the `ProtectedRoute` layout route if it needs
   a user.
2. Title: a `pageTitle` key in the feature's `copy.ts`, `"Mewki — <Page>"` (`dashboard/copy.ts`
   `pageTitle`, `auth/copy.ts`), rendered by a `<Helmet>` in the page itself (`settings.tsx`). Its
   render test then wraps the page in `HelmetProvider`. `/premium`, the callback and the landing
   have none yet.
3. Default-export the container; conditional UI goes in a named, props-only View with a
   `<page>.render.test.tsx` ([Testing](../../../../RULES.md#testing)).
4. Add its row to the table above.

## Containers and Views

- The default export wires session, `useDailify`, API, toasts and navigation. The named View takes
  only props: `BillingView`, `PlansView` (premium), `SessionRow` (security), `ProfileHero`
  (profile), `TodayHeader` (home). No test mounts a View yet: `billing.render.test.tsx` mounts the
  container with `@/lib/auth`, `@/functions/api` and `dailifyContext` mocked.
- Account pages (profile, security, settings, integrations): `<main className={accountPage}>`,
  `<PageHeader className="px-1">`, then `<div className={accountGroups}>` holding kit
  `ListGroup`/`ListRow`; both strings come from `components/settings-list.tsx`. `billing.tsx`
  uses `accountPage` but still pads groups with `mx-4 md:mx-0`: legacy, don't copy.
- Copy: `dashboard/copy.ts` `profile.*` (profile, security and settings) and `integrations` (both
  integration pages); `pricing/copy.ts` `account` (billing) and `page`/`plans` (premium);
  `auth/copy.ts` (login, signup, hand-off pages); `dashboard/copy.ts` `legal` (legal frame).

## Invariants

- Billing data (payment details, invoices) loads only on `/billing`, into `DailifyContext` so a
  revisit paints at once. On `?checkout=success` it calls
  `refetch({ query: { disableCookieCache: true } })`: the plan arrives by webhook, and the 5-minute
  session cookie cache still holds the old one.
- Hand-off pages render `<AuthShell>` with every prop omitted.
  - `/verify#token=…&next=…` spends the token only on the button click (mail scanners open links
    but don't click), strips the hash on mount, and passes `next` through `internalPath`.
  - `/auth/app?token=…` never calls verify: the token is bound to the requesting device's
    verifier. On desktop it tries `mewki://auth` once; the browser restarts at `/login`.
  - `/app/<path>` is where Stripe returns a checkout started in the app; it hands the path to
    `mewki://open` once, after `internalPath` (`/app//evil.com` would still match `/app/*`).
  - `/auth/app` and `/app/*` share `components/auth/handoff.tsx`: `useOpenOnce` and
    `HandoffNotice`.
- Single-shot effects (OAuth code, deep-link attempt) use a `useRef` flag (`integration-callback`,
  `useOpenOnce`). `integration-callback` and `verify` render tests run in `<StrictMode>`.
- Legal pages: the body text is literal in `privacy.tsx`/`terms.tsx`, the one documented
  literal-content exception (`dashboard/copy.ts` `legal`); the frame strings come from `copy.legal`.

## Tests

`billing`, `premium`, `security`, `verify`, `auth-app`, `app-return` and `integration-callback`
have render tests. The older `it` names are legacy pt-BR; new ones are English.
