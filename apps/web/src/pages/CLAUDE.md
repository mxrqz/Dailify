# `src/pages/` — routes

Routes are declared in `src/App.tsx` (react-router). Provider nesting (from `main.tsx`):
`ClerkProvider → HelmetProvider → DailifyProvider → Router → ThemeProvider`.

| Path                               | Page                          | Notes                                                                  |
| ---------------------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| `/`                                | `landingPage.tsx`             | public marketing page                                                  |
| `/dashboard`                       | `home.tsx`                    | **protected**; the app (task list + calendar, toggled by `isCalendar`) |
| `/profile`                         | `profile.tsx` → `profileTabs` | **protected**; account, plan/usage, sessions                           |
| `/login` (+ `/login/sso-callback`) | `login.tsx`                   | Clerk sign-in/up (OAuth + OTP)                                         |
| `/sign-in/verify`                  | `verify.tsx`                  | Clerk email/OTP verification                                           |
| `/task/:id`                        | `[id]/taskPreview.tsx`        | public, shareable task rendered as an image (`html-to-image`)          |
| `/premium`                         | `premium.tsx`                 | pricing + Stripe checkout                                              |

**There is no catch-all route** — a link to a non-existent path lands on a blank page. Only navigate
to paths listed above (this caused the `/prices` vs `/premium` bug).

## Auth

Clerk (`main.tsx`). Protected pages are wrapped in `ProtectedRoute` (`src/components/`), which runs the
Clerk→Firebase bridge and loads tasks/permissions before rendering.

## Billing (premium.tsx)

`handleSelectPlan(planId)` POSTs to `${serverURL}checkout` with `productName` (yearly appends
`-year`); the server returns a Stripe URL and we redirect. Plan ids come from `PLAN_ID` (`consts`).
The billing portal is fetched the same way from the server.
