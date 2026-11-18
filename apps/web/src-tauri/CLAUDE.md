# apps/web/src-tauri — the Tauri 2 shell (`com.mewki.app`)

A thin native shell around the web app, for desktop and Android. Repo-wide rules:
[/RULES.md](../../../RULES.md). Here `src/` is the Rust crate; web paths start at `apps/web`.

## Layout

- `src/lib.rs` only registers plugins (why: root `CLAUDE.md` › Gotchas).
- `tauri.conf.json` is the base config; `tauri.android.conf.json` switches `devUrl` to http and
  makes the window transparent on Android.
- `capabilities/`: `default.json` for every platform, `mobile.json` limited to Android/iOS by
  `platforms`. `gen/schemas/` is gitignored build output; `gen/android/` is committed (below).

## Plugins

- `single-instance` (desktop, feature `deep-link`) is registered first: a `mewki://` link starts a
  second process, which forwards the URL to the live instance (firing `onOpenUrl`) and exits.
- `deep-link`: scheme `mewki` on desktop; on mobile, App Links for `mewki.mxrqz.com` under
  `/auth/app` and `/app/`, plus `mewki://`. Linux and Windows debug builds call `register_all()`
  at boot, since no installer registers the scheme there.
- `keyring-store` holds the session bearer and the magic-link verifier (Keychain, Credential
  Manager, Secret Service, Android Keystore). Third-party (s00d), pinned `=0.3.2` without default
  features: bump only after reading its changelog. Only `allow-get/set/delete-passwords` are
  granted, because its `default` set also allows plaintext export.
- `opener`: its init script sends `<a target="_blank">` clicks (http, https, mailto, tel) to the
  system browser; `openExternal` covers code (RULES.md › Security and privacy).
- `haptics`: mobile only (`cfg(mobile)`), permissions in `capabilities/mobile.json`.
- `core:app:allow-exit`: `exit(0)` of the Android back button (`apps/web/src/lib/back-button.ts`).

Adding a plugin touches four places in one commit, and removing one touches the same four:

1. `Cargo.toml`, in a `[target.'cfg(...)'.dependencies]` table if desktop- or mobile-only.
2. `.plugin()` in `src/lib.rs`, inside the matching `#[cfg(desktop)]`/`#[cfg(mobile)]` block.
3. Explicit permissions in `capabilities/*.json`; individual ones when `default` is too broad.
4. The `@tauri-apps/plugin-*` npm package, only if JS imports it (dynamically, RULES.md › Frontend).

## Native auth

Flow and keyring accounts: `apps/web/src/lib/CLAUDE.md`; contract:
`docs/research/2026-11-17-better-auth.md` (Magic link).

- A bearer, not a cookie (it doesn't cross the webview origin), read from `set-auth-token` and
  kept in the keyring. The magic link is device-bound: opened elsewhere, it never makes a session.
- `tauri.conf.json` sets a CSP (defense in depth: any script injected into the webview could read
  that bearer from the keyring). Tauri hashes the inline theme script of `index.html` at build
  time; a new origin (API host, captcha, CDN) goes in its directive there. It applies to built
  assets only: the dev server proxy sends no CSP, so check a change on a release build.
- The server accepts the webview origins (`tauri://localhost`, `http(s)://tauri.localhost`) in
  `ALLOWED_ORIGIN` and `apps/server/src/lib/origin.ts`; its CORS allows `x-mewki-verifier` and
  exposes `set-auth-token` (`apps/server/src/index.ts`).

## App Links and Universal Links (files in `apps/web/public/`)

- `.well-known/assetlinks.json` lists the release keystore CI signs with (34a98cd) and the
  local debug keystore for testing with `bun run android` (ee2597d). Play App Signing re-signs the
  app, so its key's fingerprint would have to be added too.
- iOS is not initialised (no `gen/apple`): replace `TEAMID` in
  `.well-known/apple-app-site-association`, run `tauri ios init`, and add the Associated Domain
  `applinks:mewki.mxrqz.com`. `_headers` serves both files as `application/json`.

## Run

- Desktop: `bun tauri dev` from `apps/web` (`devUrl` is https because Vite uses mkcert);
  `cargo check` here. Linux needs `libdbus-1` and a running Secret Service (gnome-keyring, KWallet).
- Linux deep links work only from the `.desktop` entry `register_all()` sets up. With the app open:
  `xdg-open 'mewki://auth?token=<token>'`; handler: `xdg-mime query default x-scheme-handler/mewki`.
- Android: `bun run android` from `apps/web` runs `adb reverse` on 1420, 1421 and 8787, builds into
  `CARGO_TARGET_DIR=~/.cache/mewki-target`, and defaults `NDK_HOME` to
  `~/Android/Sdk/ndk/27.1.12297006`, the workflow's `NDK_VERSION`: bump both together. Mobile dev
  serves http and calls the API directly (`apps/web/CLAUDE.md` › Tooling).

## Release (`.github/workflows/android-release.yml`)

- Push a `v*` tag: CI attaches an arm64-only APK and AAB to a GitHub release, a prerelease when
  the tag contains `-`. A manual run uploads a `0.0.0-dev.<run>` artifact instead.
- `versionName` is the tag without `v`; `versionCode` is the workflow's `run_number`, so renaming
  the workflow file restarts it at 1 and Play rejects the build.
- Repo secrets `ANDROID_KEY_BASE64`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` (one password
  for store and key) become `gen/android/keystore.properties` (gitignored); without it a release
  build is unsigned. Repo vars `VITE_API_URL` and `VITE_TURNSTILE_SITE_KEY` are inlined.

## `gen/android`

- Committed and partly hand-edited, so never re-run `tauri android init`. Hand edits:
  `app/build.gradle.kts` (signing block), `MainActivity.kt` (`enableEdgeToEdge()`), and
  `res/values{,-night}/themes.xml`, whose `windowBackground` is the light/dark `--canvas` hex: the
  webview is transparent, so it is the boot background. Change them with `--canvas` in
  `apps/web/src/global.css`, along with `backgroundColor` (the dark one) in `tauri.conf.json`.
- The manifest's deep-link intent filters (between the `DEEP LINK PLUGIN` markers) are regenerated
  from `tauri.conf.json` on build: edit the config, not the manifest.
