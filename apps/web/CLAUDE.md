# apps/web — the React app: its layers, tooling and test harness

Only what is specific to this folder. Repo-wide rules: /RULES.md.

## Layers of `src/`

What goes where is in RULES.md "Where code goes"; this is the map, each folder with its own doc.

- `main.tsx`: on `vite:preloadError` (a deploy replaced the chunks) it reloads once, with a 10 s
  `sessionStorage` floor so a broken chunk can't loop; in Tauri it awaits `initNativeAuth` before
  the first render, so the keyring bearer is set before any request. Routes: `src/pages/CLAUDE.md`.
- `global.css`: every color, radius, z, motion token and `@utility` (`src/CLAUDE.md`).
- `components/`: `ui/` vendored shadcn, `kit/` DS primitives, root files for the app shell and
  shared state, one folder per feature; each has its own `CLAUDE.md`.
- `hooks/`: task writes, module stores, hooks two features share (`hooks/CLAUDE.md`). A hook only
  one feature uses lives beside its component: `dashboard/calendar-chip.tsx:useCalendarChip`,
  `mew-chat/apply.ts:useMewApply`.
- `functions/` API client, offline queue, app time zone, domain helpers; `lib/` Better Auth client,
  Tauri and browser adapters, `cn()`; `consts/` `apiURL`, plan map, priority classes, motion
  mirrors; `pages/`. Model types come from `@dailify/shared`.
  Beside `src/`, `src-tauri/` is the native shell.

## Tooling (`vite.config.ts`)

- Dev proxy: `/api` goes to `VITE_API_URL` from `apps/web/.env` (else `http://localhost:8787`),
  because the dev page is https (mkcert) and calling the http worker directly is mixed content (bd
  `Dailify-6aq`). `consts/conts.ts:apiURL` is `VITE_DEV_API` in dev and `VITE_API_URL` in builds.
- Mobile dev (`bun run android`, `TAURI_ENV_PLATFORM` android/ios) skips mkcert, serves http, and
  `define`s `VITE_DEV_API` as `http://127.0.0.1:8787`, bypassing the proxy: Android's Tauri request
  interception drops POST bodies. HMR moves to ws on 1421 only when `TAURI_DEV_HOST` is set.
- PWA: `vite-plugin-pwa` `autoUpdate`, with `importScripts('/push-sw.js')` so push lives in the one
  generated worker. Precache is js, css, html and woff2 only; images stay out on purpose. The SW
  runs in dev only with `PWA_DEV=1`: always on, it broke Firefox on Vite's intercepted modules.
- Deploy: Workers Builds runs the build and deploys `wrangler.jsonc` (assets `./dist`, SPA
  fallback); no deploy script here. `public/_headers` serves `.well-known/*` as JSON for App Links.
- Favicon and PWA icons: `bun scripts/icons.ts` from this folder, with `resvg` on PATH.
- E-mail logo (`public/email/mew.gif`, the Mew blinking): `bun scripts/email-mew.tsx`, with
  `resvg` and `magick` on PATH. Server e-mails link it by URL, so keep the path.

## Adding a `VITE_*` variable

Values are inlined at build time, so a missing one ships a silently broken bundle (no
`VITE_API_URL` in a production build leaves `apiURL` undefined). In one commit:

1. `src/vite-env.d.ts`: required unless the code handles its absence. `VITE_TURNSTILE_SITE_KEY` is
   the optional one: empty disables the captcha widget.
2. `.env.example`, with the local value.
3. A GitHub repo variable, passed into the build env by `.github/workflows/android-release.yml`.
4. The build env of the `dailify` Worker in Cloudflare Workers Builds.

## Test harness (`src/test/setup.ts`, the `test` block of `vite.config.ts`)

Naming, pragma, clock, mocking and query rules: RULES.md "Testing". The harness on top of them:

- The default environment is `node`; vitest 4 dropped `environmentMatchGlobs`, so jsdom is opted in
  per file. Two `.test.ts` files need it too: `functions/offline.test.ts` (localStorage) and
  `components/mew-chat/thread.test.ts`.
- `setup.ts` runs in every file, guarded by `typeof window`. Under jsdom it adds RTL `cleanup`,
  jest-dom matchers, no-op `IntersectionObserver`/`ResizeObserver`/`Element.animate`, and a
  `matchMedia` that answers `false` to every query: `(min-width: …)` renders mobile (create-fab),
  `(max-width: …)` renders desktop (sonner). For a viewport, `vi.spyOn(window, "matchMedia")` in
  `beforeEach` (`components/dashboard/create-fab.render.test.tsx`).
- `globals: true` stays although every file imports from `vitest`: RTL needs it to set the act
  environment and register auto-cleanup. `execArgv: ["--no-experimental-webstorage"]` keeps Node
  25+'s empty global `localStorage` from shadowing jsdom's.
- The config sets `clearMocks`, `restoreMocks` and `unstubGlobals`: don't call
  `vi.clearAllMocks()`/`vi.restoreAllMocks()` by hand. Clearing keeps a `mockResolvedValue`, so a
  test that needs a fresh one sets it.
- Mocks: build in `vi.hoisted`, return from `vi.mock`, import the module under test after
  (`protected-route.render.test.tsx`); partial mocks spread `importOriginal`
  (`pages/billing.render.test.tsx`). `Link`s and router hooks need a `MemoryRouter`.
- Dates: freeze "today" as `dashboard/anytime-block.render.test.tsx:79` does; zone tests call
  `setAppTimeZone(tz)` and reset it to `null` in `afterEach` (`functions/functions.test.ts`).
- Timeouts are vitest's defaults (5 s per test, 10 s per hook), which the parallel root `check`
  stretches. `vi.resetModules()` plus a dynamic import in `beforeEach` cold-loads the module graph
  inside the hook; also import that module statically so it loads at collection, as
  `components/duplicates-sheet.render.test.tsx` does.
- `userEvent.setup({ pointerEventsCheck: 0 })` only where a Radix overlay needs it (create-fab).
- A facet needing its own mocks gets its own `<name>.<facet>.render.test.tsx`
  (`dashboard/task-composer.calendar`, `.voice`) instead of another `describe`.
- Scope with `within()` when a page repeats text: `/billing` also renders the plan table.

## Gotchas

- `tsconfig.json` `lib` is ES2022 + DOM. `@types/node` globals still leak into `src` because
  `types` is unset; setting it breaks `consts/motion.test.ts` (`node:fs`). TS 5.9 with
  `verbatimModuleSyntax`: a type-only import is `import type` (or an inline `type`).
- `typecheck` also runs `tsconfig.node.json` (`vite.config.ts`, `noEmit`); `format` and `lint`
  cover `src`, `scripts`, the configs and the tsconfigs.
- `eslint.config.js` enables only `rules-of-hooks` and `exhaustive-deps` from react-hooks; `lint`
  runs with `--max-warnings 0`, so an `exhaustive-deps` warning fails the gate. No Tailwind lint.

## Verify

`bun run check` here is the web half of the gate; `bun run test src/components/kit` runs a folder.
