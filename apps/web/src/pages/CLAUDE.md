# `src/pages/` — routes

Routes are declared in `src/App.tsx` (react-router). Provider nesting (from `main.tsx`):
`ClerkProvider → HelmetProvider → DailifyProvider → Router → ThemeProvider`.

| Path            | Page                   | Notes                                                                  |
| --------------- | ---------------------- | ---------------------------------------------------------------------- |
| `/`             | `landingPage.tsx`      | public marketing page                                                  |
| `/dashboard`    | `home.tsx`             | **protected**; the app (task list + calendar, toggled by `isCalendar`) |
| `/profile`      | `profile.tsx`          | **protected**; personal data, photo, phone, timezone                   |
| `/security`     | `security.tsx`         | **protected**; active sessions and account security                    |
| `/billing`      | `billing.tsx`          | **protected**; plan, usage, invoices. Free sees usage + CTA            |
| `/settings`     | `settings.tsx`         | **protected**; theme and (soon) notifications                          |
| `/login`        | `login.tsx`            | Clerk sign-in — `AuthPage mode="signIn"` (`components/auth/`)          |
| `/signup`       | `signup.tsx`           | same machinery, `mode="signUp"` — only the copy differs                |
| `/sso-callback` | Clerk                  | `AuthenticateWithRedirectCallback`, declared inline in `App.tsx`       |
| `/verify`       | `verify.tsx`           | where the emailed magic link lands                                     |
| `/task/:id`     | `[id]/taskPreview.tsx` | public, shareable task rendered as an image (`html-to-image`)          |
| `/premium`      | `premium.tsx`          | pricing + Stripe checkout                                              |

**There is no catch-all route** — a link to a non-existent path lands on a blank page. Only navigate
to paths listed above (this caused the `/prices` vs `/premium` bug).

## Auth

Clerk (`main.tsx`). Protected pages are wrapped in `ProtectedRoute` (`src/components/`), which gates
on Clerk (`isLoaded`/`userId`) and loads tasks/permissions from `apps/server` before rendering.

## Billing (premium.tsx)

`handleSelectPlan(planId)` calls `checkout(token, productName)` (`@/functions/api`) with
`productName` (yearly appends `-year`); the server returns a Stripe URL and we redirect. Plan ids
come from `PLAN_ID` (`consts`); copy that references limits reads from `@dailify/shared`'s
`PLAN_PERMISSIONS` instead of hard-coding numbers. The billing portal (`pages/billing.tsx`) is
fetched the same way via `billingPortal`.
