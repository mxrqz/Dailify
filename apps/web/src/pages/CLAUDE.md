# `src/pages/` — routes

Routes are declared in `src/App.tsx` (react-router). Provider nesting (from `main.tsx`):
`ClerkProvider → HelmetProvider → DailifyProvider → Router → ThemeProvider`.

Every page except `home.tsx` is `React.lazy` (one chunk per route; the landing and its Mew/scenes
stay out of the dashboard entry). A new page gets a `lazy()` import too, unless it's the PWA's
`start_url`.

| Path                               | Page                       | Notes                                                                                                             |
| ---------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/`                                | `landingPage.tsx`          | public marketing page                                                                                             |
| `/dashboard`                       | `home.tsx`                 | **protected**; the app (Hoje list + month calendar, `?view=calendar`)                                             |
| `/profile`                         | `profile.tsx`              | **protected**; name (editable), Google photo or initial, read-only e-mail, sign out, delete account               |
| `/security`                        | `security.tsx`             | **protected**; Better Auth sessions (browser/OS from `functions/user-agent.ts`, IP, last use), revoke             |
| `/billing`                         | `billing.tsx`              | **protected**; plan, usage, invoices. Free sees usage + CTA                                                       |
| `/settings`                        | `settings.tsx`             | **protected**; theme, date/time, notifications, Google Agenda summary                                             |
| `/integrations`                    | `integrations.tsx`         | **protected**; Google Agenda card (connect, settings, disconnect) + "Em breve"                                    |
| `/integrations/:provider/callback` | `integration-callback.tsx` | **protected**; OAuth `redirect_uri`: POSTs `{code,state}` once (StrictMode-safe), toasts, back to `/integrations` |
| `/login`                           | `login.tsx`                | magic link + Google — `AuthPage mode="signIn"` (`components/auth/`)                                               |
| `/signup`                          | `signup.tsx`               | same machinery, `mode="signUp"` — only the copy differs                                                           |
| `/sso-callback`                    | Clerk                      | `AuthenticateWithRedirectCallback`, declared inline in `App.tsx`                                                  |
| `/verify`                          | `verify.tsx`               | web magic link `#token=…`; spends it only on the "Entrar" click (mail scanners don't click)                       |
| `/auth/app`                        | `auth-app.tsx`             | app magic link `?token=…`; tries `mewki://auth` once, NEVER calls verify (token bound to the app)                 |
| `/task/:id`                        | `[id]/taskPreview.tsx`     | public, shareable task rendered as an image (`html-to-image`)                                                     |
| `/premium`                         | `premium.tsx`              | pricing + Stripe checkout                                                                                         |

**There is no catch-all route** — a link to a non-existent path lands on a blank page. Only navigate
to paths listed above (this caused the `/prices` vs `/premium` bug).

## Auth

Better Auth (`src/lib/auth.ts`: `authClient`, `useSession`; contract in
`docs/research/2026-11-17-better-auth.md`). Protected pages are wrapped in `ProtectedRoute`
(`src/components/`), which gates on the session and loads tasks/quotas from `apps/server`.

## Billing (premium.tsx)

`handleSelectPlan(planId)` calls `checkout(token, productName)` (`@/functions/api`) with
`productName` (yearly appends `-year`); the server returns a Stripe URL and we redirect. Plan ids
come from `PLAN_ID` (`consts`); copy that references limits reads from `@dailify/shared`'s
`limitsFor` instead of hard-coding numbers. The billing portal (`pages/billing.tsx`) is
fetched the same way via `billingPortal`.
