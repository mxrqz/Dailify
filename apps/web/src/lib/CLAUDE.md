# apps/web/src/lib — platform and session plumbing

Adapters around Better Auth, Tauri plugins and browser APIs, plus two tiny helpers. Repo-wide
rules: [/RULES.md](../../../../RULES.md).

## Files

- `auth.ts`: the Better Auth client, `setBearer`/`authHeaders`, `useSession`, `planOf`. With
  `native-auth.ts` it is the only `better-auth` import, so tests mock `@/lib/auth` alone.
- `native-auth.ts`: `isTauri`, `signedOutPath`, the device-bound magic link, keyring access, the
  deep-link parsers, `initNativeAuth`, `signOut`, `signOutAndReload`.
- `back-button.ts` (Android back), `haptics.ts` (`haptic(kind)`), `open-external.ts`
  (`openExternal`).
- `form.ts`: `formString` reads `FormData` without `as string`. `utils.ts`: `cn()`, `toText`.
- No React components, no app-data calls (`functions/api.ts`), no imports from `components/`: lib
  is imported by everything, so that edge makes cycles. That is why `parseOpenLink` re-implements
  `internalPath`. The one outward import is `forgetUser` from `functions/offline`.
- `formFile` has no caller and `signOutNative` needs no export; drop them when you touch the file.

## Session

- Web: the httpOnly cookie, sent with `credentials: "include"`.
- Tauri: the cookie doesn't cross the webview origin, so the session is a bearer in keyring account
  `mewki.session`. `initNativeAuth` restores it with `setBearer` and `main.tsx` renders only after
  it settles, because the first get-session and every `api.ts` call read `authHeaders()`.
- Native magic link: `startNativeMagicLink` stores a random verifier in keyring account
  `mewki.magic-link-verifier` (the app may close before the mail arrives) and sends
  `metadata.challenge = s256(verifier)`. Verify sends `x-mewki-verifier`, reads the `set-auth-token`
  header, then deletes the verifier. The server contract lives in
  `docs/research/2026-11-17-better-auth.md` (Magic link); change both sides together.
- After a session change Better Auth doesn't signal itself (magic-link verify, bearer restore),
  call `authClient.$store.notify("$sessionSignal")`, or `useSession` keeps the stale atom.

## Deep links: the trust boundary

- `parseAuthLink` accepts only `mewki://auth?token=` and `https://<APP_HOST>/auth/app?token=`, with
  one token matching `TOKEN_RE` and no port, credentials or hash. `parseOpenLink` accepts
  `mewki://open/<path>` and `https://<APP_HOST>/app/<path>`; a path that starts with `//` or `/\`
  becomes `/dashboard`.
- Change them only together with `native-auth.test.ts`. The `/\host` case has no test yet; add it
  when you touch the parser.
- `initNativeAuth` dedupes tokens: the same link arrives via `getCurrent` and `onOpenUrl`, and the
  second verify would fail on the deleted verifier. Open links navigate with `pushState` plus a
  synthetic `popstate`, which `BrowserRouter` follows.

## Sign-out

- `signOut()` clears the last-user marker; in the app it also clears the bearer and both keyring
  accounts, even when the server call fails. `signedOutPath()` is `/login` in the app (no landing)
  and `/` on the web. Callers use `signOutAndReload(path?)`, which always ends in a full page load
  (RULES.md › Security and privacy); account deletion's SESSION_EXPIRED passes
  `/login?error=SESSION_EXPIRED`, which the auth page shows as `copy.errors.reauth`.

## External URLs

- tauri-plugin-opener's default init script sends clicks on `<a target="_blank">` with an
  http(s)/mailto/tel href to the system browser, unless a handler called `preventDefault`.
- `openExternal(url, newTab)` is for programmatic navigation (Stripe checkout and portal, OAuth,
  calendar links). On the web, `newTab: false` replaces the current page.

## Back button

- `handleBack` dispatches a cancelable Escape keydown first (Radix DismissableLayer preventDefaults
  it when it closes an overlay, and then nothing else happens), then `history.back()`, then
  `exit(0)`. Pinned by `back-button.render.test.tsx`, which mounts a real `ui/dialog`.

## `cn()`

- An extended tailwind-merge: every custom utility name (token or `@utility`) from
  `global.css` must be registered, or `text-subhead` is read as a color and dropped next to
  `text-ink-secondary`. Registered and still-missing names: `apps/web/src/CLAUDE.md`. Each new
  name gets a case in `utils.test.ts`.

## Adding a native adapter

1. A function here that checks `isTauri()` and imports the plugin dynamically (RULES.md ›
   Frontend), with a web fallback or a no-op.
2. Register the plugin in Cargo, `lib.rs` and `capabilities/` (`src-tauri/CLAUDE.md`). Haptics is
   registered only under `cfg(mobile)`, so on desktop it returns an error result and does nothing.
3. Export the pure part (parser, decision) and test it in node; DOM behavior goes in a
   `*.render.test.tsx`. `native-auth.test.ts` mocks `@/lib/auth` so the client never loads.
