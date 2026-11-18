# apps/web/src/components/auth — sign-in UI

The `/login` and `/signup` screens, plus the shell the hand-off pages reuse. Repo-wide rules:
[/RULES.md](../../../../../RULES.md).

## Layout

- `auth-page.tsx`: `AuthPage({ mode })`, mounted by `pages/login.tsx` and `pages/signup.tsx`. Both
  routes are one machine; `mode` only picks the copy and the cross-link target. A visitor who is
  already signed in is sent to `from`.
- `auth-shell.tsx` owns the layout (back, Mew bubble, title, cross-link, legal or spam footer).
  `/verify`, `/auth/app` and `/app/*` render it with every prop omitted.
- `email-form.tsx`, `check-inbox.tsx`, `oauth-buttons.tsx`: props-only bodies.
- `auth-state.ts`: the pure reducer, `classifyAuthError`, `canResend`, `internalPath`,
  `redirectTarget`. `use-email-link-auth.ts` only wires Better Auth to it. `turnstile.ts` is the
  captcha hook.
- `copy.ts`: every string here, plus those of `pages/verify.tsx`, `auth-app.tsx`, `app-return.tsx`,
  the auth `<title>`s in `App.tsx` and the invalid-link toast in `main.tsx`.

## State machine (`auth-state.ts`)

- `idle -> sending(resendOf?) -> awaitingLink | error(email?)`, and `reset` returns to `idle`.
  `resendOf` keeps the inbox on screen during a resend. `error.email` refills the form after a
  failed resend. Any `if` that isn't about the Better Auth API goes here, with a test.
- `classifyAuthError`: 429 -> `tooManyRequests`, `VALIDATION_ERROR`/`INVALID_EMAIL` ->
  `invalidEmail`, `MISSING_RESPONSE`/`VERIFICATION_FAILED` -> `captcha`, `null` (fetch threw) ->
  `network`. Anything else is `generic`, with the code (or status) shown in mono for bug reports.
- `internalPath`/`redirectTarget` are the repo's open-redirect guard
  ([RULES.md, Security and privacy](../../../../../RULES.md#security-and-privacy)). Keep the `//`
  and `/\` cases in `auth-state.test.ts`.

## Wiring (`use-email-link-auth.ts`)

- Better Auth calls are read as `{ data, error }`. A throw maps to `classifyAuthError(null)`.
- Every send and every `reset` bumps the `runId` ref, so a slow send that resolves after "Usar outro
  e-mail" is a no-op. That is also why the back button stays enabled while a resend is in flight.
- `from` = `redirectTarget(location.state)`. The AuthShell cross-link forwards `location.state`, and
  on the web `from` becomes the `callbackURL`. In Tauri, `startNativeMagicLink`
  (`lib/native-auth.ts`) sends a device-bound link with no callback.
- Google is hidden in Tauri (bd `Dailify-rzz.8`: the webview redirect doesn't come back with the
  session). A failure returns as `/login?error=<code>`, even from `/signup`, and shows as `generic`.

## Turnstile (`turnstile.ts`)

- `interaction-only`, and the script loads only when an auth page mounts. Each send takes a fresh
  single-use `token()`, sent as `x-captcha-response`, and the widget resets for the next one.
- With no token within 15 s, or a blocked script, the send goes out with `""` and the server answers
  with a captcha error. An empty `VITE_TURNSTILE_SITE_KEY` disables it (dev, tests).
- The captcha `<div ref>` sits outside the form/inbox conditional in `AuthPage`, because a resend
  needs it mounted.

## Coupled values and copy

- The 10 minutes in `copy.inbox.hint` = `LINK_TTL_S = 600` in `apps/server/src/auth-options.ts`.
  Change both.
- `AuthCopy` (`typeof copy`) is the contract for the future `en` locale (bd `Dailify-1xy`).
- The legal footer is 4 keys (`legalPrefix` per mode, `shell.terms`, `shell.legalAnd`,
  `shell.privacy`) because it holds two inline links.
- Legacy, don't copy: the resend countdown concatenates `resendIn` + number + `seconds` (use one
  `{seconds}` template and `fill()`, [RULES.md](../../../../../RULES.md#copy-and-i18n)), and
  Turnstile's `language: "pt-br"` is hard-coded.

## How to add

- A server error code: a branch in `classifyAuthError` and an `it` in `auth-state.test.ts`, a new
  `AuthErrorKey`, its `copy.errors` entry, and its name in the `copy.test.ts` list.
  `pages/verify.tsx` renders `copy.errors` too.
- A screen state: write the action and state in the reducer, test first, then render it in
  `AuthPage`.

## Tests

- `bun run test src/components/auth` from `apps/web` runs `auth-state.test.ts` and `copy.test.ts`.
- `AuthPage` and `CheckInbox` have no render test yet
  ([RULES.md, Testing](../../../../../RULES.md#testing)). The hand-off pages have theirs in
  `pages/`.
