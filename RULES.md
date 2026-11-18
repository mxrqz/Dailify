# Rules for writing code in this repo

Repo-wide. An area's `CLAUDE.md` adds to or narrows these rules for its folder, and the user's chat
wins over both. Where a `bd` memory contradicts this file, this file wins; fix the memory. Paths are
relative to the package they name (`apps/web/src`, `apps/server/src`, `packages/shared/src`).

## Verify

- Run `bun run check` from the root before calling work done: format:check, lint, typecheck and
  tests in every package, in parallel. No CI runs it and Cloudflare deploys `main` on every push, so
  it is the only gate. Shared changes need this root run: web and server compile shared as source
  with different TS versions and libs.
- One file: `bun run test <path>` from the package dir. Not `bun test`, which is bun's own runner.
- A test that passes alone but times out under `bun run check` is a bug (a cold import inside a
  hook, an oracle redoing work per iteration). Fix it; never raise `testTimeout`/`hookTimeout`.
- A `CLAUDE.md` under a package's `src/` (or `apps/server/test/`) is inside that package's prettier
  gate: run `bun run format` after editing one.

## Where code goes

- Imports flow `apps/web -> @dailify/shared <- apps/server`. The apps never import each other;
  anything both need lives in shared.
- Shared admits only wire types and constants, logic both apps must compute identically, and pure
  logic that must stay in step with those (`rrule.ts` mirrors `recurrence.ts`). A helper used by
  one app stays in that app.
- Web layers: `functions/` = domain logic and the API client; `lib/` = platform and third-party
  adapters (Better Auth, Tauri, browser APIs); `hooks/` = hooks used by 2+ feature folders and
  app-wide stores; `components/{ui,kit,<root>,<feature>}`; `pages/`; `consts/`. No `utils/` or
  `helpers/` folders, and no new exports in the `functions/functions.ts` grab-bag. Details:
  `apps/web/CLAUDE.md`.
- Server layers: `routes/` validate and wire, `lib/` and `integrations/` do the work, `db/` holds
  every SQL statement. `db/` never imports hono or returns a `Response`. Details:
  `apps/server/CLAUDE.md`.
- Pure logic (state machines, parsers, list transforms, decision tables) goes in a plain `.ts` file
  with a colocated test; components, hooks and routes only wire it, because only the pure half is
  testable without a DOM or a request. See `components/auth/auth-state.ts`,
  `components/mew-chat/thread.ts`, `lib/task-input.ts` (server).
- Dependency direction inside the web: the app never imports `components/landing/**` (a piece both
  use lives in `components/mew/` or `components/kit/`); `functions/` never imports hooks, pages or
  component runtime code (copy.ts and `import type` are fine); `lib/` never imports `components/`.
  Imports use `@/` across folders and `./` only between siblings, never `../`.

## TypeScript

- No `as` assertions except `as const`; narrow with a type guard. ESLint errors on it in apps/web;
  the root config (shared, server) still says `warn` with zero violations, so treat it as an error.
  This covers `c.req.json<T>()` and `res.json() as T` too: parse as `unknown`, then narrow
  (`isRecord` in `lib/openai.ts`, server).
- A table keyed by a union is `Record<K, T>` or `satisfies Record<K, T>`, so a new member is a
  compile error (`QUOTAS` in `quotas.ts`, `PROVIDERS` in `integrations/registry.ts`). Test an
  untrusted string against a table with `Object.hasOwn` or `.some`, never `in`, which walks the
  prototype (`"toString" in map` is true).
- Every JSON body between server and web is a named type in `@dailify/shared`. The server builds it
  with `satisfies T` and the web passes the same `T` to `request<T>()`; never redeclare a wire shape
  in `functions/api.ts` or a server file.
- Use `import type` for type-only imports. Delete an export, with its test, once no production code
  calls it; a test alone doesn't keep code alive.

## Dates and time zones

- Instants are epoch-ms numbers end to end. Stripe fields are Unix seconds; say so on the field.
- Web: never build a `Date` to read calendar fields or to feed date-fns. Use `zoned()`/`zonedAt()`
  from `functions/zone.ts` and send `appTimeZone()` to the server; the account zone can differ from
  the device zone. Show clock times through `formatClock(hhmm, hour12)` (`functions/functions.ts`).
- In render, read time from `useNow("day")` (`useNow(60_000)` only where minutes show), not
  `Date.now()`, because the app stays open across midnight. `Date.now()` is fine in handlers.
- Every date-fns week function gets `{ weekStartsOn: weekStart }` from `useDailify()`: the default
  user's week starts Monday, date-fns' on Sunday.
- Shared and server: a function that turns wall time into epoch-ms, or reads Y/M/D from one, takes a
  required `timeZone` (or a `TZDate`); the Worker runs in UTC, so an optional zone fails silently.
  Pure functions take `now` as a parameter.

## Frontend

- Split a component into a props-only View (no `useDailify`, `useSession`, API or router hooks) and
  a container that wires hooks, in one file or a sibling `*-views.tsx`. Tests and previews mount the
  View without providers. See `components/dashboard/composer-views.tsx` + `task-composer.tsx`,
  `BillingView` in `pages/billing.tsx`.
- Reuse a primitive before writing markup: `kit/` (ListGroup/ListRow, Switch, SegmentedControl,
  Chip, PageHeader, ActionSheet) and `ui/` (Button, Dialog, Sheet, Tip). Don't override a Button's or
  Chip's height, radius or color with `className`; add a variant.
- A primitive that may sit under `XTrigger asChild` uses `forwardRef` and spreads props onto the
  focusable element, or the trigger opens nothing (`components/kit/chip.tsx`).
- Task writes never import `@/functions/api` from a component; they go through
  `hooks/useTaskActions`, `useUndatedActions` or `useCreateTask`, which keep the shared lists in
  sync. Contract: apply optimistically, call, then settle (success keeps it, `offline` or 401
  enqueues it, anything else rolls back and toasts). See `run` in `hooks/useUndatedActions.ts`.
- After an `await` or from an Undo, never set a shared list from a render-time snapshot; it reverts
  every write that landed meanwhile. Use a functional update, widening the setter type in
  `components/dailifyContext.tsx` to `Dispatch<SetStateAction<...>>` instead of adding another
  `latest` ref.
- Recurring instances share the series id and carry `date` = occurrence, `seriesStart` = anchor. A
  series-level write uses the anchor and shifts a changed date from it; writing the instance as the
  series erases its earlier occurrences.
- Never omit effect deps or disable exhaustive-deps; read fresh values through `useEffectEvent`
  (`hooks/useEffectEvent.ts`). Context functions (`loadMonth`, `goToDay`, ...) are new every render
  and never go in deps.
- Never write a ref during render; sync it in an effect. Per-frame values go to the DOM through refs
  inside rAF, never through state (`components/mew/mew.tsx`).
- Don't put hot, per-row or per-frame state in `DailifyContext`: every change re-renders ~30
  consumers. Use a module store with `useSyncExternalStore` (`hooks/useIntegrations.ts`).
- Guard a non-idempotent effect (single-use token, OAuth code, deep link) with a `useRef` flag and
  test it under `<StrictMode>` (`pages/integration-callback.tsx`).
- File names are kebab-case, except hooks (`useX.ts`, `.tsx` only when it returns JSX). Named exports
  everywhere except lazy pages. Conditional classes go through `cn()`. Lucide icons are imported by
  their `*Icon` names.
- Load Tauri APIs with a dynamic `import("@tauri-apps/...")` behind `isTauri()`, never
  statically, so the web bundle stays free of them (`lib/haptics.ts`).
- Icon-only controls get an `aria-label` from copy; hover hints use `<Tip>`, not `title=`; small
  controls use the `hit-target` utility for a 44px touch area.

## Styling and tokens

- No arbitrary Tailwind values: use the scale (`ring-3`, `min-w-32`, `top-1/2`) and add a token when
  none fits. Allowed: state/data/aria/group variants, grid track lists, transition-property lists,
  Radix CSS vars, and values with no scale (`-ml-[100%]`, `ch` units). No linter checks this yet.
- All tokens live in `apps/web/src/global.css`; how to add a color, radius, z layer or duration is in
  `apps/web/src/CLAUDE.md`. A new custom utility name is also registered in `extendTailwindMerge`
  (`lib/utils.ts`) with a test, or `cn()` silently keeps two conflicting classes.
- Outside `components/ui/`, use only the DS color names (`ink*`, `canvas`, `surface*`, `fill*`,
  `separator`, `brand*`, `meta-*`, `priority-*`, ...). The legacy aliases (`surface-panel`,
  `surface-popover`, `surface-line`) and the shadcn names (`foreground`,
  `muted-foreground`, `accent`) resolve at `:root`, so they don't step up a tone inside `.glass`.
- Define a color once with `light-dark()` in oklch. No hex, except vendor logos, SVG filter constants
  and native contexts that can't read CSS variables (PWA manifest, Android `themes.xml`), each
  naming its token in a comment. Prefer solid state colors to `/opacity` on interactive elements.
- A class recipe repeated in 3+ files becomes an `@utility` or a kit component; a repeat inside one
  file becomes a module const. Inline `style` is only for runtime values (MotionValues, measured
  sizes, CSS vars like `--i`).

## Motion

- Easings and durations come from tokens: CSS `duration-*`/`ease-*`, JS `duration`/`ease`/`spring`
  from `@/consts/motion`. A new value goes in both `global.css` and `consts/motion.ts`
  (`motion.test.ts` fails on drift). Every `transition-*` carries a duration token.
  `landing/sections/**` may use scale durations for one-off choreography, never a re-declared curve.
- Pick the engine by job: CSS transitions and `@starting-style` for enter and state changes, WAAPI
  on a ref for one-shot gestures, `motion` for exit, layout, drag and springs.
- Animate transform and opacity only, plus the exceptions listed in `apps/web/src/CLAUDE.md`. Never
  animate `filter`/blur: inside a filtered bubble it re-runs the filter every frame.
- No bounce in app UI (`spring.soft`, `spring.snappy`); `ease-spring` is landing-only.
- Reduced motion: an imperative `animate()` branches on `useReducedMotion()` (`MotionConfig` doesn't
  reach it); CSS loops ship `motion-reduce:`; JS loops pause off-screen and render their final frame.

## Copy and i18n

- Every visible string, aria-labels, toasts and error fallbacks included, lives in a feature's
  `copy.ts` in pt-BR: an English locale is planned (bd `Dailify-1xy`) and copy.ts is the file that
  gets one per language. A new shared feature gets its own folder and `copy.ts`. Today
  `components/dashboard/copy.ts` is the dictionary of the whole authenticated app.
- Interpolate with `fill(template, values)` (`functions/functions.ts`) and `{placeholder}` keys, not
  `.replace`: a string replacement expands `$&` from user text and replaces only once. Never build a
  phrase with a template literal or by concatenating keys, since word order changes per language.
  This supersedes the `.replace` advice in bd `copy-i18n`.
- Copy maps keyed by a domain union use `satisfies Record<Union, string>`. API enum values (e.g.
  Stripe invoice status) reach the UI through such a map, never raw.
- Standing exceptions: the existing Helmet `<title>` literals in `App.tsx` (a new page's title goes
  in copy, `apps/web/src/pages/CLAUDE.md`), legal body text, and strings riding along with a
  component being moved (migrate them in their own step).

## Backend and API

- Errors go through `fail(c, status, msg, extra?)` (`lib/errors.ts`), with `msg` as short English
  for developers. Anything the web reacts to carries a `code` from a shared `as const` registry
  (`INTEGRATION_ERROR` in `integrations.ts`, shared); the web branches on `error.code`, never on the
  message.
- Read a body as `unknown`; a pure `parseX(body)` returns `{ error }` or the value and the route only
  maps it. Task-shaped bodies always go through `parseTaskFields`/`parseNewTask`
  (`lib/task-input.ts`).
- Identity comes only from `c.get("userId")`/`c.get("plan")`. Every query on user data takes `userId`
  and filters on `user_id`; a row owned by someone else answers 404.
- Every authenticated route has a rate limiter mounted after `requireAuth`, because the limiter keys
  on the userId: `API_LIMITER` for D1 and Stripe, `AI_LIMITER` for anything calling OpenAI.
- Third-party work after a successful write (calendar push, e-mail, revoke) runs in
  `c.executionCtx.waitUntil`, swallows its errors and records a recoverable state (`stale`); it never
  fails the user's write (`integrations/propagate.ts`).
- Every outbound call has an explicit timeout (`{ timeout }` per SDK call, `AbortSignal.timeout` on
  fetch): the OpenAI SDK defaults to 600 s with retries, and fetch has none.
- AI: `aiQuota` before the call, `debitAi` only after a reply that passed its guard, 502 with no
  debit on failure. The model names refs and the server builds every Task; untrusted text (titles,
  invites, chat) never goes into `instructions`. Call details: `apps/server/src/lib/CLAUDE.md`.
- Cron and batch passes isolate failures per item and always persist progress (`syncIfDue` in
  `integrations/google-calendar/sync.ts`).
- SQL lives only in `apps/server/src/db/`. Writes that must hold together are one `db.batch([...])`
  of `*Statement` builders (D1 has no BEGIN). Concurrency guards go in SQL (`WHERE updated_at<=?`,
  `ON CONFLICT ... WHERE`, `RETURNING`), not in JS between a read and a write. Bind id lists as one
  `json_each(?)` parameter: D1 caps a statement at 100.
- Migrations are additive and never edited once on main (`apps/server/migrations/CLAUDE.md`). A new
  table with a `user_id` column is added to `deleteUserData`: account deletion is an LGPD promise.
- A new secret lands in one commit in `Env` (`src/index.ts`), `.env.example` and a fake binding in
  `vitest.config.ts`; tests load the local `.env`, so a missing fixture means the real key. Bindings
  and vars are declared in `wrangler.toml` with a one-line why.

## Shared model

- Shared code is isomorphic: ESNext plus the globals in `src/globals.d.ts`, no DOM, Node, `fetch`,
  Workers bindings or React. No module-level mutable state beyond memo caches keyed by input, since
  Worker isolates serve concurrent users.
- A new closed set (plan, quota, provider, error code) is one registry keyed by a union plus a
  guard-filtered key list (`QUOTAS`/`QUOTA_KEYS`). Numbers live once: plan limits only in
  `quotas.ts`, content caps only in `limits.ts`.

## Comments and language

- Code, identifiers, comments, docs, test names, commits and server messages are English; only UI
  copy in `copy.ts` is pt-BR.
- Comment only a non-obvious why, in one short line: no docblocks narrating the code, no history,
  no claims about call sites, no emoji. Leave legacy pt-BR comments alone unless you are rewriting
  that code; their migration is its own task (bd `Dailify-1yp`).
- Mark a deliberate shortcut with a `ponytail:` comment naming the ceiling and the upgrade path.

## Testing

- A pure function with a branch gets a colocated `<module>.test.ts`. A component with conditional
  state gets a `<module>.render.test.tsx` with `/** @vitest-environment jsdom */` on line 1 (bd
  `Dailify-040`: /billing once shipped blank for Free users). A server route or query change adds or
  updates `apps/server/test/<area>-<feature>.test.ts`.
- Use `describe` + `it`, one English behavior sentence per `it`. Harness details:
  `apps/web/CLAUDE.md`, `apps/server/test/CLAUDE.md`.
- Never depend on the machine zone or the real clock: freeze `Date` with
  `vi.useFakeTimers({ toFake: ["Date"] })` + `setSystemTime` and pass explicit zones. Suites must
  pass under any `TZ`.
- Mock I/O boundaries (`@/functions/api`, `@/lib/auth`, `dailifyContext`, `sonner`, `stripe`,
  `openai`, global `fetch`), never the shared model or date math. Query by role and accessible name
  with names from copy.ts, and prefer user-event to `fireEvent`.

## Security and privacy

- Any path from outside the app (location.state, query, hash, deep link) goes through
  `internalPath()` (`components/auth/auth-state.ts`) before a `Link`, `navigate` or callback URL;
  React Router treats `//host` as external.
- Sign out with `signOutAndReload()` (`lib/native-auth.ts`), never `signOut()` plus `navigate()`:
  the context above the router keeps the previous user's tasks.
- External links are `<a target="_blank" rel="noreferrer">`; programmatic ones use `openExternal()`
  (`lib/open-external.ts`). Anything else navigates the Tauri webview away from the app.
- localStorage only through try/catch wrappers (`hooks/useStoredFlag.ts`, `functions/offline.ts`);
  per-user keys (`dailify:<what>:<userId>`, `chatKey`) are also removed in `clearLocal`. `VITE_*` values are
  inlined into the public bundle, so never put a secret there.

## Git and task tracking

- Track work in `bd` and knowledge with `bd remember`: no TodoWrite, markdown TODOs or MEMORY.md.
- Commits are English conventional commits, `type(scope): ...` with scope `web`, `server`, `shared`
  or `tauri`, unscoped for repo-wide work (`ci: ...`). No `Co-Authored-By` trailer.
- Never `git push` unless the user asks. This overrides the push step of the generated "Session
  Completion" block in `CLAUDE.md` (bd `git-push`).
- Edit existing files with the Edit tool, not `sed` or inline scripts: an ambiguous match then fails
  instead of rewriting the wrong line (bd `edicao-precisa`).

## Maintaining these rules

- Each rule has one home: repo-wide here, local invariants and "how to add a new X" in the folder's
  `CLAUDE.md`, which links here instead of copying. Add a rule after the same correction comes up
  twice; a rule with no exceptions belongs in ESLint or a test, and this file then only names it.
