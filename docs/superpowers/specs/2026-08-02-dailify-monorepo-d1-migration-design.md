# Dailify — Monorepo + Cloudflare/D1 Backend Migration (Design)

**Date:** 2026-08-02
**Status:** Approved design → implementation planning
**Beads epic:** _to be created_

## 1. Context & goals

Today Dailify is a Vite/React SPA (Cloudflare) plus a separate Node/Express server on Render
(`dailify-server`). Reads go **client → Firestore directly** through a Clerk→Firebase custom-token
bridge; writes (create/edit/complete/voice/billing) go through the Render server, which uses
`firebase-admin`. Pain points: Render cold-start, `firebase-admin` complexity, type/pricing drift
between the two repos, a mixed `Date | Timestamp` union that keeps causing runtime crashes, and a
non-functional trigger.dev notification path.

**Goals**

1. One **monorepo** (bun workspaces) holding the web app, the server, and shared code.
2. Rewrite the server as **Hono on Cloudflare Workers** (kills Render cold-start; free tier).
3. Move the data store to **Cloudflare D1** (SQLite). Firestore + the Firebase bridge are removed.
4. A **`packages/shared`** package as the single source of truth for types, pricing/permissions,
   and recurrence logic — so the two apps can't drift again.
5. **Real tests** (vitest) for shared logic and server handlers.
6. Reconcile pricing/permissions and fix the bugs found during the audit.

**Non-goals (deferred)**

- **Notifications / WhatsApp reminders** — own epic later. Meta's messaging policy forces a pivot, so
  the current trigger.dev path (already dead — it POSTs to `http://localhost:3333`) is dropped now.
- Migrating existing Firestore task data — **fresh start** (app is pre-launch, Stripe in test mode).
- Changing auth: **Clerk stays** the identity provider.

## 2. Decisions

| # | Decision | Choice |
|---|----------|--------|
| D1 | Data layer | **Cloudflare D1** (all reads move server-side; client no longer touches the DB) |
| D2 | Repo layout | **Full monorepo**: `apps/web`, `apps/server`, `packages/shared` (bun workspaces) |
| D3 | Notifications | **Deferred** to a later epic |
| D4 | Pricing | Free 30/0/❌ · Pro 300/∞/❌ · Pro+AI ∞/∞/✅ (see §8) |
| D5 | Permissions shape | **Slimmed** — drop `taskLimits.daily` and the `whatsapp.*` block |
| D6 | Wire date format | **epoch milliseconds (`number`)** everywhere across the API and in shared `Task` |
| D7 | Data migration | **None** — D1 starts empty |
| D8 | Server framework | **Hono** on Workers; existing `dailify-server` repo is archived (no history merge) |

## 3. Repository structure

```
Dailify/                     # repo root = monorepo
  package.json               # { "workspaces": ["apps/*", "packages/*"] }
  apps/
    web/                     # current frontend, moved verbatim from repo root
      package.json
      vite.config.ts
    server/                  # NEW — Hono Worker
      package.json
      wrangler.toml
      migrations/            # D1 SQL migrations
      src/
  packages/
    shared/                  # pure, no I/O — safe in both browser and Worker
      package.json
      src/
  docs/ .beads/ CLAUDE.md    # stay at root
```

- Web workspace name `@dailify/web`, server `@dailify/server`, shared `@dailify/shared`; the apps
  depend on `@dailify/shared` via the workspace protocol.
- **Cloudflare web build** re-points: root directory `apps/web`, build `bun run build`, output
  `apps/web/dist`. Server deploys separately with `wrangler`.

## 4. `packages/shared`

Pure TypeScript, **no** `firebase`, no Node APIs — importable by the browser and the Worker.

- **`types.ts`** — canonical model:
  ```ts
  export type Repeat = "Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] };
  export interface Task {
    id: string;
    title: string;
    description: string;
    date: number;           // epoch ms
    alert?: number;         // epoch ms
    duration: string;       // e.g. "10m", "1h30m"
    priority: number;       // 0–4
    repeat: Repeat;
    tags?: string[];
    completed: number[];    // epoch ms
  }
  export type TaskInput = Omit<Task, "id" | "completed"> & { id?: string };
  export type Role = "free" | "pro" | "pro+ai" | "admin";
  export interface Permissions {
    taskLimits: { monthly: number; recurring: number };   // -1 = unlimited
    features: { voiceCreation: boolean };
  }
  export interface Entitlements { /* as today, derived from Permissions + tasksUsed */ }
  export const PLAN_ID = { free: "free", pro: "pro", proAi: "pro+ai" } as const;
  ```
- **`pricing.ts`** — `PLAN_PERMISSIONS: Record<Role, Permissions>` (the §8 matrix) and
  `computeEntitlements(permissions, tasksUsed)`. The server enforces from this; the web pricing page
  displays from this.
- **`recurrence.ts`** — the ONE recurrence engine: `expandRecurringTask(task, month)`,
  `normalizeRepeat(unknown)`, `weekDays`, `dayMap`. Replaces both the frontend `expandRecurringTask`
  and the server's separate `getTaskByIds` matching.
- **`dates.ts`** — small shared date helpers if needed (all in epoch ms).

Existing `src/functions/functions.test.ts` recurrence tests move here and must stay green.

## 5. Data model (D1)

One table; recurring tasks are found by `repeat_kind != 'Off'`, so Firestore's `repeatTasks`
membership-doc denormalization (and its bugs) is **deleted**.

```sql
CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  date        INTEGER NOT NULL,               -- epoch ms
  alert       INTEGER,                        -- epoch ms, nullable
  duration    TEXT NOT NULL,
  priority    INTEGER NOT NULL DEFAULT 0,
  repeat_kind TEXT NOT NULL DEFAULT 'Off',    -- Off | Daily | Weekly | Monthly | Yearly
  repeat_days TEXT,                           -- JSON array of weekday names, Weekly only
  tags        TEXT,                           -- JSON array
  completed   TEXT NOT NULL DEFAULT '[]'      -- JSON array of epoch ms
);
CREATE INDEX idx_tasks_user_date   ON tasks(user_id, date);
CREATE INDEX idx_tasks_user_repeat ON tasks(user_id, repeat_kind);
```

- Row ⇄ `Task` mapping lives in one module (`db/tasks.ts`): JSON-encode `repeat`/`tags`/`completed`
  on write, decode on read. A stored `Task` always has consistent epoch-ms dates.
- **Recurring instances are generated, never stored.** A month read returns stored in-range rows
  plus generated instances (shared id, materialized `date`), deduped by `` `${id}-${date}` ``.

## 6. API contract

Base URL = the Worker origin (web reads it from `VITE_API_URL`). All routes require
`Authorization: Bearer <Clerk JWT>` **except** the Stripe webhook. Dates in bodies/responses are
epoch ms.

| Method | Path | Body → Response | Notes |
|--------|------|-----------------|-------|
| GET | `/tasks?month=YYYY-MM` | → `{ tasks: Task[] }` | in-range rows + expanded recurring, deduped |
| POST | `/tasks` | `TaskInput` → `{ task }` \| `{ error }` 429 | server sets `id` if absent; enforces monthly + recurring limits |
| PATCH | `/tasks/:id` | `Partial<TaskInput>` → `{ task }` | edit does **not** count against creation limits |
| POST | `/tasks/:id/complete` | → `{ task }` | append `now` to `completed` |
| DELETE | `/tasks/:id` | → 204 | |
| POST | `/tasks/voice` | multipart `audio` → `{ tasks: Task[] }` | **Pro+AI only** (403 otherwise) |
| GET | `/permissions` | → `Permissions` | from `PLAN_PERMISSIONS[role]` |
| GET | `/billing/payment-details` | → `PaymentDetails` | |
| GET | `/billing/invoices` | → `Invoice[]` | |
| POST | `/billing/checkout` | `{ productName }` → `{ url }` | checkout or portal if already subscribed |
| GET | `/billing/portal` | → `{ url }` | |
| POST | `/webhooks/stripe` | raw → 200 | signature via `constructEventAsync`; read raw body first |

**Enforcement (server-side, the real d69.5):** monthly limit = count of stored tasks whose `date`
falls in the current calendar month; recurring limit = count of stored tasks with
`repeat_kind != 'Off'`. `-1` = unlimited. Free recurring = 0 ⇒ recurring creation rejected.

## 7. `apps/server` (Hono on Workers)

- **Framework**: Hono. Bindings: `DB` (D1). CORS locked to `ALLOWED_ORIGIN`.
- **Auth**: `@hono/clerk-auth` middleware; `userId` from the verified Clerk JWT (Web Crypto, no
  network round-trip; set `CLERK_JWT_KEY` if we want fully offline verification).
- **Stripe**: `new Stripe(key, { httpClient: Stripe.createFetchHttpClient() })`; webhook via
  `constructEventAsync` on the raw body.
- **OpenAI voice**: `c.req.parseBody()` → build a `File` from the upload → Whisper transcription →
  GPT task extraction → normalize dates (Luxon or `Intl`) → insert. **No filesystem.**
- **Layout**: `src/index.ts` (app + routes), `src/middleware/auth.ts`, `src/db/tasks.ts` (row⇄Task +
  queries + enforcement helpers), `src/routes/{tasks,billing,voice}.ts`, `src/lib/{stripe,openai,clerk}.ts`.
- **Bugs fixed here** (see §11): `getUser(userId)` instead of `getUserList().find()`; CORS not `*`;
  edit doesn't consume the creation limit; consistent JSON error envelope + real HTTP status codes.

## 8. Pricing / permissions (final)

| Plan (`Role`) | `taskLimits.monthly` | `taskLimits.recurring` | `features.voiceCreation` |
|---|---|---|---|
| `free`   | 30  | 0  | false |
| `pro`    | 300 | -1 | false |
| `pro+ai` | -1  | -1 | true  |
| `admin`  | -1  | -1 | true  |

`daily` and `whatsapp.*` are removed from `Permissions`. `computeEntitlements` derives `recurrence`
as `recurring !== 0` (so Free, with 0, correctly gets no recurrence — fixing today's leak).

## 9. `apps/web` changes

- Replace `src/functions/firebase.ts` with `src/functions/api.ts`: a thin fetch client (Clerk token
  in `Authorization`) for tasks CRUD + month read + billing. `VITE_API_URL` config.
- **Delete the Firebase bridge** in `protected-route.tsx` (the `signInWithCustomToken` /
  `onAuthStateChanged` / `onIdTokenChanged` effects + `isFirebaseLogged`). Reads become `GET /tasks`.
- Remove the `firebase` dependency and the `signOut(auth)` calls in `login.tsx` / `header.tsx`
  (Clerk `signOut` remains the real logout).
- `Task.date`/`alert`/`completed` become `number` (epoch ms). Delete `Timestamp` usage and the
  `toJsDate` union handling; convert to `Date` only at render (date-fns accepts numbers). **This
  dissolves the `Date | Timestamp` union — pz9.9 and the whole `.toDate()` crash class resolved by
  construction.**
- `computeEntitlements` / `useEntitlements` import from `@dailify/shared`.
- Pricing page reads plan limits/features from `PLAN_PERMISSIONS` (no hard-coded "300" drift).

## 10. Testing (vitest)

- **shared** — recurrence expansion (ported tests), `computeEntitlements`/pricing edge cases
  (Free/Pro/Pro+AI, unlimited, at-limit), `normalizeRepeat`, date helpers.
- **server** — handlers against **real D1** via `@cloudflare/vitest-pool-workers` (miniflare);
  Clerk/Stripe/OpenAI mocked. Cover: auth required (401), CRUD round-trip, month read includes
  expanded recurring, monthly-limit enforcement (429 at cap), recurring rejected on Free, voice 403
  for non-Pro+AI.
- `bun run check` gate extended to run all workspace tests.

## 11. Bugs fixed during the migration

- 🔴 `isUserOnClerk` used `getUserList()` (10-user page) + `.find()` → broke past 10 users. → `getUser(userId)`.
- 🔴 Firebase service-account private key was committed to the repo. → gone (no Firebase on the server).
- 🔴 Pricing disagreed across server / pricing page / docs. → single `PLAN_PERMISSIONS` in shared.
- 🟠 `recurrence` entitlement leaked to Free (recurring:2). → Free recurring:0 + `!== 0` gate.
- 🟠 Two divergent recurrence engines. → one in shared.
- 🟠 CORS `origin:"*"` on an authed API. → locked to app origin.
- 🟠 `checkTaskLimit` ran on edit (editing blocked at cap). → edit path skips creation limits.
- 🟡 Committed `.ogg` audio files; `res.send(200)` (body not status); `repeat`/date type drift.

## 12. Deployment & secrets

- **Worker** (`wrangler`): D1 database + `DB` binding; secrets `CLERK_SECRET_KEY`
  (+ optional `CLERK_JWT_KEY`), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the four Stripe price
  ids, `OPENAI_API_KEY`, and `ALLOWED_ORIGIN`. Stripe test keys now; swap to live at launch.
- **Web** (Cloudflare static): build root `apps/web`; env `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_URL`.
- Point the Stripe webhook at `POST /webhooks/stripe`.

## 13. Rollout phases (detailed plan comes from writing-plans)

0. Scaffold monorepo: move web → `apps/web`, init bun workspaces, `packages/shared` skeleton;
   verify web still builds and deploys.
1. `packages/shared`: types + pricing + recurrence + dates + ported tests.
2. `apps/server`: Hono skeleton on Workers, D1 schema/migrations, Clerk middleware, health check.
3. Server tasks endpoints (CRUD + month read) + enforcement + tests.
4. Server billing + Stripe webhook + `/permissions`.
5. Server voice (OpenAI, no disk), Pro+AI gated.
6. `apps/web`: swap `firebase.ts` → `api.ts`, delete bridge, epoch-ms dates, remove `firebase`,
   wire `VITE_API_URL`.
7. Cleanup: remove `firestore.rules` / `firebase.json` / `.firebaserc` / audio files; archive the old
   `dailify-server` repo.
8. Deploy: `wrangler` (server + D1 + secrets), point web `VITE_API_URL`, cut over.

## 14. Risks & mitigations

- **Clerk JWT verification on Workers** — use `@hono/clerk-auth`; set `CLERK_JWT_KEY` for offline verify.
- **D1 in tests** — `@cloudflare/vitest-pool-workers` config; run migrations against the test DB.
- **Stripe webhook raw body** — read `c.req.arrayBuffer()`/`text()` before any body parsing.
- **Voice upload size / Worker CPU** — Whisper/GPT are network-bound (fine); cap upload size.
- **Cutover** — fresh D1 means existing test tasks vanish (accepted, D7). Keep the old Render server
  running until the Worker is verified, then decommission.
