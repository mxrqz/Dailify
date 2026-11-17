# src-tauri — o app nativo (Tauri 2, `com.mewki.app`)

Casca fina em volta da mesma web app. Nada de lógica de negócio em Rust: só plugins.

## Como o app autentica

Contrato completo em `docs/research/2026-11-17-better-auth.md` (Magic link). Código em
`apps/web/src/lib/native-auth.ts`.

- **Sessão por bearer**, não cookie (o cookie não atravessa a origem da webview). O token vem no
  header `set-auth-token` e mora no **cofre do sistema** (`tauri-plugin-keyring-store`: Keychain,
  Credential Manager, Secret Service, Android Keystore). No boot, `initNativeAuth` lê o cofre e chama
  `setBearer`.
- **Magic link amarrado ao aparelho (PKCE-like)**: `startNativeMagicLink` gera um verifier, guarda no
  cofre e manda `challenge = base64url(sha256(verifier))`. O e-mail traz
  `https://mewki.mxrqz.com/auth/app?token=…` (Universal/App Link no celular) ou a página abre
  `mewki://auth?token=…` (desktop). O app valida a URL, faz o GET de verify com `x-mewki-verifier`,
  e um link aberto em outro aparelho não vira sessão.
- **Deep link**: `tauri-plugin-deep-link` (scheme `mewki` no desktop, App Links em `/auth/app` no
  mobile). `tauri-plugin-single-instance` (feature `deep-link`) vem primeiro: no desktop o link abre
  um segundo processo, que repassa a URL pra instância viva e sai.
- Capabilities (`capabilities/default.json`): só `get/set/delete_passwords` do cofre — o `default`
  dele libera export de senhas em texto puro.

## O que o dono configura

- **iOS**: Apple Team ID → trocar `TEAMID` em `public/.well-known/apple-app-site-association`;
  `tauri ios init` + Associated Domains `applinks:mewki.mxrqz.com` no target.
- **Android**: keystore de release → `keytool -list -v -keystore <ks>` e o SHA-256 em
  `public/.well-known/assetlinks.json`. O plugin de deep link injeta o intent-filter no
  `AndroidManifest.xml` no build.
- `public/_headers` serve os dois `.well-known` como `application/json` (exigência da Apple/Google).
- Servidor: CORS precisa aceitar a origem da webview (`tauri://localhost`, `http://tauri.localhost`),
  o header `x-mewki-verifier` e expor `set-auth-token`.

## Rodar e testar

- `cargo check` aqui dentro; `bun tauri dev` em `apps/web` (o Vite serve HTTPS via mkcert, por isso
  `devUrl` é `https://localhost:1420`). Linux precisa de `libdbus-1` e um Secret Service rodando
  (gnome-keyring/KWallet) pro cofre.
- **Deep link no Linux**: só funciona com o app rodando a partir de um `.desktop` registrado —
  `register_all()` cuida disso no boot (Linux e Windows-debug). Com o app aberto:
  `xdg-open 'mewki://auth?token=<token>'`. Conferir o handler: `xdg-mime query default
  x-scheme-handler/mewki`.
