# Dailify Monorepo + Cloudflare/D1 Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Dailify into a bun-workspaces monorepo with a Hono/Cloudflare-Workers server on D1, a shared package that ends type/pricing drift, and real tests — replacing the Render/Express/Firestore backend.

**Architecture:** `packages/shared` holds the canonical `Task` model (epoch-ms dates), the pricing matrix, and the one recurrence engine. `apps/server` is a Hono Worker: Clerk-authed, D1-backed, Stripe/OpenAI via fetch. `apps/web` (the current SPA, moved) drops Firebase entirely and reads/writes through the server API. Reads move server-side because the client can't reach D1.

**Tech Stack:** bun workspaces · Hono · Cloudflare Workers + D1 (wrangler) · Clerk (`@hono/clerk-auth`, `@clerk/backend`) · Stripe (fetch client) · OpenAI · vitest (+ `@cloudflare/vitest-pool-workers`) · React 18 + Vite (web).

## Global Constraints

- Package manager: **bun**. Every install is `bun add` / `bun install`.
- **No `as` type assertions** (use type guards / proper types); `as const` is allowed. ESLint `consistent-type-assertions: never` is a warning.
- **Prettier** `printWidth: 100`. Run `bun run format` before committing; `bun run check` is the full gate.
- Dates crossing the API and stored in D1 are **epoch milliseconds (`number`)**. Never `Date | Timestamp`. No `firebase` import anywhere after Phase 6.
- Pricing/permissions come **only** from `@dailify/shared`'s `PLAN_PERMISSIONS`. No hard-coded limits in web or server.
- Pricing matrix (verbatim): `free` = monthly 30 / recurring 0 / voice false; `pro` = 300 / -1 / false; `pro+ai` = -1 / -1 / true; `admin` = -1 / -1 / true. `-1` = unlimited.
- `Permissions` shape is slimmed: `{ taskLimits: { monthly, recurring }, features: { voiceCreation } }`. No `daily`, no `whatsapp`.
- TDD: failing test first, then minimal code. Commit per task. Do **not** `git push` (standing user instruction — commits stay local).
- **bd (beads)** for task tracking, not markdown TODO. Each phase = a bd issue under the epic.

## File Structure

```
Dailify/
  package.json                 # workspaces: ["apps/*","packages/*"]; root scripts delegate
  packages/shared/
    package.json               # name "@dailify/shared", exports ./src/index.ts
    tsconfig.json
    src/
      index.ts                 # re-exports
      types.ts                 # Task, TaskInput, Repeat, Role, Permissions, Entitlements, PLAN_ID, billing DTOs
      pricing.ts               # PLAN_PERMISSIONS, computeEntitlements
      recurrence.ts            # expandRecurringTask, normalizeRepeat, weekDays, dayMap
      dates.ts                 # epoch-ms helpers
      *.test.ts
  apps/server/
    package.json               # name "@dailify/server"
    wrangler.toml              # D1 binding, vars
    tsconfig.json
    vitest.config.ts           # @cloudflare/vitest-pool-workers
    migrations/0001_tasks.sql
    src/
      index.ts                 # Hono app + route mounting
      middleware/auth.ts       # Clerk middleware -> userId
      db/tasks.ts              # row<->Task mapping, queries, limit counts
      routes/tasks.ts
      routes/billing.ts
      routes/voice.ts
      lib/stripe.ts
      lib/openai.ts
      lib/clerk.ts             # getUser(userId), role/plan read, metadata writes
      lib/errors.ts            # JSON error envelope helper
    test/*.test.ts
  apps/web/                    # the CURRENT frontend, moved verbatim from repo root
    package.json               # add @dailify/shared; remove firebase
    src/functions/api.ts       # replaces firebase.ts
    (existing src/, public/, index.html, vite.config.ts, tsconfig*.json, etc.)
  docs/ .beads/ CLAUDE.md      # stay at root
```

---

## Phase 0 — Monorepo scaffold

### Task 0.1: Convert repo to bun workspaces and move the web app into `apps/web`

**Files:**
- Create: `package.json` (new root), `apps/web/` (moved), `packages/shared/` (skeleton)
- Modify: `apps/web/vite.config.ts` (path alias unaffected), root `CLAUDE.md` (monorepo note)

**Interfaces:**
- Produces: workspace layout; `apps/web` builds exactly as before.

- [ ] **Step 1: Move the current frontend into `apps/web`**

```bash
mkdir -p apps/web
# Move everything web-related; keep docs/, .beads/, .git/, CLAUDE.md, node_modules out of the move.
git mv src public index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json \
       components.json eslint.config.js .prettierrc.json package.json bun.lock apps/web/ 2>/dev/null || true
# Any other root config the web build needs (e.g. postcss/tailwind, .npmrc): git mv it too.
ls apps/web
```
Note: the nested `src/**/CLAUDE.md` files travel with `src/`. If `git mv` skips a file, move it explicitly. The root `CLAUDE.md` stays at repo root.

- [ ] **Step 2: Create the root workspace `package.json`**

```json
{
  "name": "dailify",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun --filter @dailify/web dev",
    "build": "bun --filter @dailify/web build",
    "test": "bun --filter '*' test",
    "check": "bun --filter '*' check"
  }
}
```

- [ ] **Step 3: Point `@dailify/web` at itself and install**

Set `apps/web/package.json` `"name": "@dailify/web"` and ensure it has its own `check` script
(`format:check && lint && tsc -b && test`). Then:
```bash
bun install
```
Expected: a single root `bun.lock`; `node_modules` hoisted at root.

- [ ] **Step 4: Verify the web app still builds**

Run: `bun --filter @dailify/web build`
Expected: build succeeds, output in `apps/web/dist`.

- [ ] **Step 5: Update Cloudflare + root docs, commit**

Add a short "Monorepo" note to root `CLAUDE.md` (root dir for the web deploy is now `apps/web`,
output `apps/web/dist`). Record the Cloudflare dashboard change as a manual step (do it later at deploy).
```bash
git add -A && git commit -m "chore: convert to bun-workspaces monorepo; move web to apps/web"
```

---

## Phase 1 — `packages/shared`

### Task 1.1: Shared package skeleton + canonical types

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/index.ts`, `packages/shared/src/types.ts`

**Interfaces:**
- Produces: `Task`, `TaskInput`, `Repeat`, `Role`, `Permissions`, `Entitlements`, `PLAN_ID`, `PaymentDetails`, `Invoice` — imported by web and server.

- [ ] **Step 1: Create the package files**

`packages/shared/package.json`:
```json
{
  "name": "@dailify/shared",
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "check": "tsc --noEmit && vitest run" },
  "devDependencies": { "typescript": "^5.0.0", "vitest": "^2.0.0" }
}
```
`packages/shared/tsconfig.json`: `{ "compilerOptions": { "strict": true, "module": "ESNext", "moduleResolution": "bundler", "target": "ESNext", "lib": ["ESNext"], "noEmit": true, "verbatimModuleSyntax": true } }`

- [ ] **Step 2: Write `types.ts`**

```ts
export type Repeat = "Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] };

export interface Task {
  id: string;
  title: string;
  description: string;
  date: number;        // epoch ms
  alert?: number;      // epoch ms
  duration: string;    // "10m", "1h30m"
  priority: number;    // 0-4
  repeat: Repeat;
  tags?: string[];
  completed: number[]; // epoch ms
}

export type TaskInput = Omit<Task, "id" | "completed"> & { id?: string; completed?: number[] };

export type Role = "free" | "pro" | "pro+ai" | "admin";

export interface Permissions {
  taskLimits: { monthly: number; recurring: number }; // -1 = unlimited
  features: { voiceCreation: boolean };
}

export interface Entitlements {
  loading: boolean;
  voice: boolean;
  recurrence: boolean;
  monthlyLimit: number;
  unlimited: boolean;
  tasksUsed: number;
  remaining: number;
  canCreateTask: boolean;
}

export const PLAN_ID = { free: "free", pro: "pro", proAi: "pro+ai" } as const;

export interface PaymentDetails { amount: number; currency: string; start: number; recurring: "year" | "month"; }
export interface Invoice {
  amount_paid: number; currency: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void" | null;
  created: number; hosted_invoice_url: string | null | undefined;
  recurring: "year" | "month"; brandName?: string; cardLast4?: string;
  walletType?: string; paymentMethodType?: string;
}
```

- [ ] **Step 3: Write `index.ts`**

```ts
export * from "./types";
export * from "./pricing";
export * from "./recurrence";
export * from "./dates";
```
(pricing/recurrence/dates land in the next tasks; create empty stubs `export {};` so `tsc` passes, or reorder to add them first.)

- [ ] **Step 4: Verify types compile**

Run: `cd packages/shared && bunx tsc --noEmit`
Expected: PASS (with stubs in place).

- [ ] **Step 5: Commit**

```bash
git add packages/shared && git commit -m "feat(shared): package skeleton + canonical Task/Permissions types"
```

### Task 1.2: Pricing matrix + entitlements (TDD)

**Files:**
- Create: `packages/shared/src/pricing.ts`, `packages/shared/src/pricing.test.ts`

**Interfaces:**
- Consumes: `Permissions`, `Role`, `Entitlements` from `./types`.
- Produces: `PLAN_PERMISSIONS: Record<Role, Permissions>`, `computeEntitlements(permissions: Permissions | undefined, tasksUsed: number): Entitlements`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { PLAN_PERMISSIONS, computeEntitlements } from "./pricing";

describe("PLAN_PERMISSIONS", () => {
  it("free = 30 monthly, 0 recurring, no voice", () => {
    expect(PLAN_PERMISSIONS.free).toEqual({ taskLimits: { monthly: 30, recurring: 0 }, features: { voiceCreation: false } });
  });
  it("pro = 300 monthly, unlimited recurring, no voice", () => {
    expect(PLAN_PERMISSIONS.pro).toEqual({ taskLimits: { monthly: 300, recurring: -1 }, features: { voiceCreation: false } });
  });
  it("pro+ai = unlimited, voice on", () => {
    expect(PLAN_PERMISSIONS["pro+ai"]).toEqual({ taskLimits: { monthly: -1, recurring: -1 }, features: { voiceCreation: true } });
  });
});

describe("computeEntitlements", () => {
  it("free at limit cannot create", () => {
    const e = computeEntitlements(PLAN_PERMISSIONS.free, 30);
    expect(e.canCreateTask).toBe(false);
    expect(e.remaining).toBe(0);
    expect(e.recurrence).toBe(false); // recurring:0
  });
  it("free under limit can create", () => {
    expect(computeEntitlements(PLAN_PERMISSIONS.free, 5).canCreateTask).toBe(true);
  });
  it("pro is unlimited-recurrence but capped monthly", () => {
    const e = computeEntitlements(PLAN_PERMISSIONS.pro, 299);
    expect(e.recurrence).toBe(true);
    expect(e.unlimited).toBe(false);
    expect(e.canCreateTask).toBe(true);
  });
  it("undefined permissions = loading, premium off, creation not blocked", () => {
    const e = computeEntitlements(undefined, 0);
    expect(e.loading).toBe(true);
    expect(e.voice).toBe(false);
    expect(e.canCreateTask).toBe(true);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cd packages/shared && bunx vitest run src/pricing.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `pricing.ts`**

```ts
import type { Permissions, Role, Entitlements } from "./types";

export const PLAN_PERMISSIONS: Record<Role, Permissions> = {
  free:     { taskLimits: { monthly: 30,  recurring: 0  }, features: { voiceCreation: false } },
  pro:      { taskLimits: { monthly: 300, recurring: -1 }, features: { voiceCreation: false } },
  "pro+ai": { taskLimits: { monthly: -1,  recurring: -1 }, features: { voiceCreation: true  } },
  admin:    { taskLimits: { monthly: -1,  recurring: -1 }, features: { voiceCreation: true  } },
};

export function computeEntitlements(permissions: Permissions | undefined, tasksUsed: number): Entitlements {
  const monthlyLimit = permissions?.taskLimits.monthly ?? -1;
  const recurringLimit = permissions?.taskLimits.recurring ?? 0;
  const unlimited = monthlyLimit < 0;
  const remaining = unlimited ? Infinity : Math.max(0, monthlyLimit - tasksUsed);
  return {
    loading: permissions === undefined,
    voice: permissions?.features.voiceCreation ?? false,
    recurrence: recurringLimit !== 0,
    monthlyLimit, unlimited, tasksUsed, remaining,
    canCreateTask: unlimited || remaining > 0,
  };
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `cd packages/shared && bunx vitest run src/pricing.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/pricing.* && git commit -m "feat(shared): PLAN_PERMISSIONS matrix + computeEntitlements"
```

### Task 1.3: Recurrence engine (port existing tests to epoch-ms)

**Files:**
- Create: `packages/shared/src/recurrence.ts`, `packages/shared/src/recurrence.test.ts`
- Reference: current `apps/web/src/functions/functions.ts` (`expandRecurringTask`, `normalizeRepeat`) and `functions.test.ts`

**Interfaces:**
- Consumes: `Task`, `Repeat` from `./types`.
- Produces: `expandRecurringTask(task: Task, month: Date): Task[]`, `normalizeRepeat(value: unknown): Repeat`, `weekDays: string[]`, `dayMap: Record<string, number>`.

- [ ] **Step 1: Port the tests, converting dates to epoch ms**

Copy the recurrence cases from `apps/web/src/functions/functions.test.ts`. `Task.date` is now a
number, and `expandRecurringTask` returns instances whose `date` is a number (epoch ms). Example:
```ts
import { describe, it, expect } from "vitest";
import { expandRecurringTask, normalizeRepeat } from "./recurrence";
import type { Task } from "./types";

const base: Task = {
  id: "t1", title: "x", description: "", duration: "10m", priority: 0,
  completed: [], repeat: "Daily",
  date: new Date(2026, 0, 10, 9, 0, 0).getTime(), // Jan 10 2026 09:00 local
};

describe("expandRecurringTask", () => {
  it("Daily fills the rest of the creation month, skipping the original day", () => {
    const out = expandRecurringTask(base, new Date(2026, 0, 1));
    const days = out.map((t) => new Date(t.date).getDate());
    expect(days).not.toContain(10);           // original day covered by the stored row
    expect(days).toContain(11);
    expect(days[days.length - 1]).toBe(31);
  });
  it("emits nothing before the task existed", () => {
    expect(expandRecurringTask(base, new Date(2025, 11, 1))).toEqual([]);
  });
  it("Weekly matches weekday names", () => {
    const wk: Task = { ...base, repeat: { Weekly: ["Monday"] } };
    const out = expandRecurringTask(wk, new Date(2026, 0, 1));
    expect(out.every((t) => new Date(t.date).getDay() === 1)).toBe(true);
  });
});

describe("normalizeRepeat", () => {
  it("passes valid keywords through", () => { expect(normalizeRepeat("Daily")).toBe("Daily"); });
  it("coerces junk to Off", () => { expect(normalizeRepeat(42)).toBe("Off"); });
  it("accepts a Weekly object", () => { expect(normalizeRepeat({ Weekly: ["Monday"] })).toEqual({ Weekly: ["Monday"] }); });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd packages/shared && bunx vitest run src/recurrence.test.ts` → FAIL

- [ ] **Step 3: Implement `recurrence.ts`**

Port from `functions.ts`, changing the date type to number. Compute on `new Date(task.date)`, emit
`instance(date)` as `{ ...task, date: date.getTime() }`. Keep the same rules (Daily/Weekly skip the
original day; Monthly/Yearly skip the creation month; clamp overflow days; nothing before creation).
Include `weekDays` (index 0=Sunday) and `dayMap`. Add `date-fns` (`endOfMonth`) as a dep or compute
last-day-of-month manually (`new Date(year, mon+1, 0).getDate()`).

```ts
import type { Task, Repeat } from "./types";

export const weekDays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export const dayMap: Record<string, number> =
  Object.fromEntries(weekDays.map((d, i) => [d, i]));

export function normalizeRepeat(value: unknown): Repeat {
  if (value === "Off" || value === "Daily" || value === "Monthly" || value === "Yearly") return value;
  if (value && typeof value === "object" && "Weekly" in value) {
    const weekly = (value as { Weekly: unknown }).Weekly;
    if (Array.isArray(weekly)) return { Weekly: weekly };
  }
  return "Off";
}

export function expandRecurringTask(task: Task, month: Date): Task[] {
  const original = new Date(task.date);
  const year = month.getFullYear();
  const mon = month.getMonth();
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const monthEnd = new Date(year, mon + 1, 0, 23, 59, 59, 999);
  if (monthEnd.getTime() < original.getTime()) return [];

  const inCreationMonth = original.getFullYear() === year && original.getMonth() === mon;
  const at = (day: number) =>
    new Date(year, mon, day, original.getHours(), original.getMinutes(), original.getSeconds()).getTime();
  const instance = (date: number): Task => ({ ...task, date });
  const repeat = task.repeat;

  if (typeof repeat === "string") {
    switch (repeat) {
      case "Daily": {
        const out: Task[] = [];
        for (let d = inCreationMonth ? original.getDate() + 1 : 1; d <= daysInMonth; d++) out.push(instance(at(d)));
        return out;
      }
      case "Monthly":
        return inCreationMonth ? [] : [instance(at(Math.min(original.getDate(), daysInMonth)))];
      case "Yearly":
        return original.getMonth() !== mon || original.getFullYear() === year
          ? [] : [instance(at(Math.min(original.getDate(), daysInMonth)))];
      default: return [];
    }
  }
  const repeatDays = repeat?.Weekly;
  if (!Array.isArray(repeatDays) || repeatDays.length === 0) return [];
  const out: Task[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    if (inCreationMonth && d === original.getDate()) continue;
    const ts = at(d);
    if (repeatDays.includes(weekDays[new Date(ts).getDay()])) out.push(instance(ts));
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd packages/shared && bunx vitest run` → all PASS

- [ ] **Step 5: Add `dates.ts` + commit**

`dates.ts` with the small helpers the apps need (start with `startOfMonthMs`/`endOfMonthMs` used by
the server month query):
```ts
export const startOfMonthMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getTime();
export const endOfMonthMs = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
```
```bash
git add packages/shared && git commit -m "feat(shared): single recurrence engine + normalizeRepeat + date helpers"
```

---

## Phase 2 — Server skeleton

### Task 2.1: Init `apps/server` (Hono + wrangler + vitest-workers)

**Files:**
- Create: `apps/server/package.json`, `apps/server/wrangler.toml`, `apps/server/tsconfig.json`, `apps/server/vitest.config.ts`, `apps/server/src/index.ts`

**Interfaces:**
- Produces: a deployable Hono app with a `GET /health` route and a D1 binding `DB`.

- [ ] **Step 1: Scaffold and add deps**

```bash
mkdir -p apps/server/src apps/server/migrations apps/server/test
cd apps/server
bun add hono @hono/clerk-auth @clerk/backend stripe openai
bun add -d wrangler @cloudflare/workers-types @cloudflare/vitest-pool-workers vitest typescript
```
`package.json` name `@dailify/server`, add `@dailify/shared` as a workspace dep
(`"@dailify/shared": "workspace:*"`), scripts: `"dev": "wrangler dev"`, `"deploy": "wrangler deploy"`,
`"test": "vitest run"`, `"check": "tsc --noEmit && vitest run"`.

- [ ] **Step 2: `wrangler.toml`**

```toml
name = "dailify-server"
main = "src/index.ts"
compatibility_date = "2026-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "dailify"
database_id = "PLACEHOLDER"   # filled by `wrangler d1 create dailify` at deploy (Task 8)

[vars]
ALLOWED_ORIGIN = "https://dailify.mxrqz.com"
```
Secrets (`CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY`, the four
Stripe price ids, optional `CLERK_JWT_KEY`) are set via `wrangler secret put` at deploy, never in the file.

- [ ] **Step 3: `src/index.ts` with health route + CORS + typed env**

```ts
import { Hono } from "hono";
import { cors } from "hono/cors";

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  OPENAI_API_KEY: string;
  STRIPE_PRICE_PRO: string; STRIPE_PRICE_PRO_YEAR: string;
  STRIPE_PRICE_PROAI: string; STRIPE_PRICE_PROAI_YEAR: string;
}

const app = new Hono<{ Bindings: Env }>();
app.use("*", (c, next) => cors({ origin: c.env.ALLOWED_ORIGIN, allowMethods: ["GET","POST","PATCH","DELETE"] })(c, next));
app.get("/health", (c) => c.json({ ok: true }));
export default app;
```

- [ ] **Step 4: `vitest.config.ts` (Workers pool)**

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
export default defineWorkersConfig({
  test: { poolOptions: { workers: { wrangler: { configPath: "./wrangler.toml" } } } },
});
```

- [ ] **Step 5: Health test + commit**

`test/health.test.ts`:
```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index";
describe("health", () => {
  it("returns ok", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
```
Run: `cd apps/server && bunx vitest run` → PASS
```bash
git add apps/server && git commit -m "feat(server): Hono Worker skeleton + D1 binding + health test"
```

### Task 2.2: D1 migration + `db/tasks.ts` row⇄Task mapping (TDD)

**Files:**
- Create: `apps/server/migrations/0001_tasks.sql`, `apps/server/src/db/tasks.ts`, `apps/server/test/db-tasks.test.ts`

**Interfaces:**
- Consumes: `Task`, `Repeat` from `@dailify/shared`; `D1Database`.
- Produces: `rowToTask(row): Task`, `insertTask(db, userId, task): Promise<Task>`, `getMonthTasks(db, userId, month: Date): Promise<Task[]>` (raw rows, no expansion), `countMonthlyTasks(db, userId, month): Promise<number>`, `countRecurringTasks(db, userId): Promise<number>`, `getTask/updateTask/deleteTask/appendCompletion`.

- [ ] **Step 1: Write the migration**

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  date INTEGER NOT NULL, alert INTEGER,
  duration TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 0,
  repeat_kind TEXT NOT NULL DEFAULT 'Off', repeat_days TEXT,
  tags TEXT, completed TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_tasks_user_date ON tasks(user_id, date);
CREATE INDEX idx_tasks_user_repeat ON tasks(user_id, repeat_kind);
```

- [ ] **Step 2: Write the failing test**

The Workers pool applies migrations automatically when configured; add
`migrations = "./migrations"` support via `applyD1Migrations` in a `test/apply-migrations.ts` setup, or
run them in a `beforeAll`. Test round-trips a task through insert→read:
```ts
import { env } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import { applyD1Migrations } from "cloudflare:test";
import { insertTask, getMonthTasks, countRecurringTasks } from "../src/db/tasks";
import type { Task } from "@dailify/shared";

beforeAll(async () => { await applyD1Migrations(env.DB, env.TEST_MIGRATIONS); });

const t = (over: Partial<Task> = {}): Task => ({
  id: "a1", title: "T", description: "d", date: new Date(2026,0,15,9).getTime(),
  duration: "10m", priority: 0, repeat: "Off", completed: [], tags: ["x"], ...over,
});

describe("db/tasks", () => {
  it("round-trips a task", async () => {
    await insertTask(env.DB, "u1", t());
    const rows = await getMonthTasks(env.DB, "u1", new Date(2026,0,1));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "a1", tags: ["x"], repeat: "Off", completed: [] });
  });
  it("stores Weekly repeat as kind+days", async () => {
    await insertTask(env.DB, "u2", t({ id: "a2", repeat: { Weekly: ["Monday"] } }));
    expect(await countRecurringTasks(env.DB, "u2")).toBe(1);
  });
});
```
(Configure `TEST_MIGRATIONS` per `@cloudflare/vitest-pool-workers` docs — a `defineWorkersConfig`
`miniflare.bindings` reading the migrations dir. If that setup is fiddly, apply the raw SQL in
`beforeAll` via `env.DB.exec`.)

- [ ] **Step 3: Run test, verify fail**

Run: `cd apps/server && bunx vitest run test/db-tasks.test.ts` → FAIL

- [ ] **Step 4: Implement `db/tasks.ts`**

```ts
import type { Task, Repeat } from "@dailify/shared";
import { startOfMonthMs, endOfMonthMs } from "@dailify/shared";

interface Row {
  id: string; user_id: string; title: string; description: string;
  date: number; alert: number | null; duration: string; priority: number;
  repeat_kind: string; repeat_days: string | null; tags: string | null; completed: string;
}

function repeatToCols(repeat: Repeat): { kind: string; days: string | null } {
  if (typeof repeat === "string") return { kind: repeat, days: null };
  return { kind: "Weekly", days: JSON.stringify(repeat.Weekly) };
}
function colsToRepeat(kind: string, days: string | null): Repeat {
  if (kind === "Weekly") return { Weekly: days ? JSON.parse(days) : [] };
  if (kind === "Daily" || kind === "Monthly" || kind === "Yearly") return kind;
  return "Off";
}
export function rowToTask(r: Row): Task {
  return {
    id: r.id, title: r.title, description: r.description, date: r.date,
    alert: r.alert ?? undefined, duration: r.duration, priority: r.priority,
    repeat: colsToRepeat(r.repeat_kind, r.repeat_days),
    tags: r.tags ? JSON.parse(r.tags) : undefined, completed: JSON.parse(r.completed),
  };
}
export async function insertTask(db: D1Database, userId: string, task: Task): Promise<Task> {
  const { kind, days } = repeatToCols(task.repeat);
  await db.prepare(
    `INSERT INTO tasks (id,user_id,title,description,date,alert,duration,priority,repeat_kind,repeat_days,tags,completed)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(task.id, userId, task.title, task.description, task.date, task.alert ?? null,
         task.duration, task.priority, kind, days,
         task.tags ? JSON.stringify(task.tags) : null, JSON.stringify(task.completed)).run();
  return task;
}
export async function getMonthTasks(db: D1Database, userId: string, month: Date): Promise<Task[]> {
  const { results } = await db.prepare(
    `SELECT * FROM tasks WHERE user_id=? AND date>=? AND date<=?`
  ).bind(userId, startOfMonthMs(month), endOfMonthMs(month)).all<Row>();
  return results.map(rowToTask);
}
export async function getRecurringTasks(db: D1Database, userId: string): Promise<Task[]> {
  const { results } = await db.prepare(
    `SELECT * FROM tasks WHERE user_id=? AND repeat_kind!='Off'`
  ).bind(userId).all<Row>();
  return results.map(rowToTask);
}
export async function countMonthlyTasks(db: D1Database, userId: string, month: Date): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND date>=? AND date<=?`
  ).bind(userId, startOfMonthMs(month), endOfMonthMs(month)).first<{ n: number }>();
  return row?.n ?? 0;
}
export async function countRecurringTasks(db: D1Database, userId: string): Promise<number> {
  const row = await db.prepare(
    `SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND repeat_kind!='Off'`
  ).bind(userId).first<{ n: number }>();
  return row?.n ?? 0;
}
export async function getTask(db: D1Database, userId: string, id: string): Promise<Task | null> {
  const r = await db.prepare(`SELECT * FROM tasks WHERE user_id=? AND id=?`).bind(userId, id).first<Row>();
  return r ? rowToTask(r) : null;
}
export async function deleteTask(db: D1Database, userId: string, id: string): Promise<void> {
  await db.prepare(`DELETE FROM tasks WHERE user_id=? AND id=?`).bind(userId, id).run();
}
export async function appendCompletion(db: D1Database, userId: string, id: string, at: number): Promise<Task | null> {
  const task = await getTask(db, userId, id);
  if (!task) return null;
  const completed = [...task.completed, at];
  await db.prepare(`UPDATE tasks SET completed=? WHERE user_id=? AND id=?`)
    .bind(JSON.stringify(completed), userId, id).run();
  return { ...task, completed };
}
export async function updateTask(db: D1Database, userId: string, id: string, patch: Partial<Task>): Promise<Task | null> {
  const cur = await getTask(db, userId, id);
  if (!cur) return null;
  const next: Task = { ...cur, ...patch, id };
  const { kind, days } = repeatToCols(next.repeat);
  await db.prepare(
    `UPDATE tasks SET title=?,description=?,date=?,alert=?,duration=?,priority=?,repeat_kind=?,repeat_days=?,tags=? WHERE user_id=? AND id=?`
  ).bind(next.title, next.description, next.date, next.alert ?? null, next.duration, next.priority,
         kind, days, next.tags ? JSON.stringify(next.tags) : null, userId, id).run();
  return next;
}
```

- [ ] **Step 5: Run test, verify pass; commit**

Run: `cd apps/server && bunx vitest run test/db-tasks.test.ts` → PASS
```bash
git add apps/server && git commit -m "feat(server): D1 tasks migration + row<->Task mapping + counts"
```

### Task 2.3: Clerk auth middleware (TDD)

**Files:**
- Create: `apps/server/src/middleware/auth.ts`, `apps/server/src/lib/clerk.ts`, `apps/server/src/lib/errors.ts`, `apps/server/test/auth.test.ts`

**Interfaces:**
- Produces: `requireAuth` Hono middleware setting `c.set("userId", string)`; `getUserRole(env, userId): Promise<Role>` (via `clerkClient.users.getUser` — NOT `getUserList`).

- [ ] **Step 1: Failing test — protected route 401 without token**

```ts
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import app from "../src/index";
describe("auth", () => {
  it("401 without a token", async () => {
    const res = await app.request("/tasks?month=2026-01", {}, env);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run, verify fail** (route/middleware not present) → FAIL

- [ ] **Step 3: Implement middleware + clerk lib + error helper**

`lib/errors.ts`:
```ts
import type { Context } from "hono";
export const fail = (c: Context, status: number, error: string) => c.json({ error }, status);
```
`lib/clerk.ts`:
```ts
import { createClerkClient } from "@clerk/backend";
import type { Role } from "@dailify/shared";
import type { Env } from "../index";
export function clerk(env: Env) {
  return createClerkClient({ secretKey: env.CLERK_SECRET_KEY, publishableKey: env.CLERK_PUBLISHABLE_KEY });
}
export async function getUserRole(env: Env, userId: string): Promise<Role> {
  const user = await clerk(env).users.getUser(userId); // direct lookup — fixes the getUserList()/10-user bug
  const plan = user.privateMetadata?.plan;
  return plan === "pro" || plan === "pro+ai" || plan === "admin" ? plan : "free";
}
```
`middleware/auth.ts` (using `@hono/clerk-auth`):
```ts
import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { MiddlewareHandler } from "hono";
import { fail } from "../lib/errors";
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) return fail(c, 401, "Unauthorized");
  c.set("userId", auth.userId);
  await next();
};
export { clerkMiddleware };
```
In `index.ts`, mount `clerkMiddleware()` before protected routes and add a placeholder
`app.get("/tasks", requireAuth, (c) => c.json({ tasks: [] }))` so the 401 path is exercised
(replaced in Task 3.1). Extend the `Variables` generic: `new Hono<{ Bindings: Env; Variables: { userId: string } }>()`.

- [ ] **Step 4: Run, verify pass** → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server && git commit -m "feat(server): Clerk auth middleware + getUserRole (direct getUser)"
```

---

## Phase 3 — Tasks endpoints

### Task 3.1: `GET /tasks?month=YYYY-MM` (month read + recurring expansion)

**Files:**
- Create: `apps/server/src/routes/tasks.ts`, `apps/server/test/tasks-read.test.ts`
- Modify: `apps/server/src/index.ts` (mount `routes/tasks.ts`)

**Interfaces:**
- Consumes: `getMonthTasks`, `getRecurringTasks` (db), `expandRecurringTask` (shared), `requireAuth`.
- Produces: `GET /tasks` → `{ tasks: Task[] }` = in-range rows + expanded recurring instances, deduped by `` `${id}-${date}` ``.

- [ ] **Step 1: Failing test**

```ts
// seed a Daily task in Jan 2026 for user u; GET /tasks?month=2026-01 with a stubbed auth returns >1 instance
```
Stub auth in tests by mounting a test-only middleware that sets `userId`, OR issue a real Clerk test
JWT. Simplest: export the route factory and unit-test the handler with a fake context. Prefer a small
integration: set `c.set("userId","u")` via a test middleware wrapper. Assert the Daily task expands to
multiple days and the deduped count matches.

- [ ] **Step 2: Run, verify fail** → FAIL

- [ ] **Step 3: Implement the route**

```ts
import { Hono } from "hono";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { getMonthTasks, getRecurringTasks } from "../db/tasks";
import { expandRecurringTask, type Task } from "@dailify/shared";
import { fail } from "../lib/errors";

const tasks = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
tasks.use("*", requireAuth);

tasks.get("/", async (c) => {
  const userId = c.get("userId");
  const monthParam = c.req.query("month"); // "YYYY-MM"
  if (!monthParam) return fail(c, 400, "month required");
  const [y, m] = monthParam.split("-").map(Number);
  const month = new Date(y, m - 1, 1);

  const [inRange, recurring] = await Promise.all([
    getMonthTasks(c.env.DB, userId, month),
    getRecurringTasks(c.env.DB, userId),
  ]);
  const expanded = recurring.flatMap((t) => expandRecurringTask(t, month));
  const byKey = new Map<string, Task>();
  for (const t of [...inRange, ...expanded]) byKey.set(`${t.id}-${t.date}`, t);
  return c.json({ tasks: [...byKey.values()] });
});

export default tasks;
```
Mount in `index.ts`: `app.route("/tasks", tasks);` (remove the placeholder from Task 2.3).

- [ ] **Step 4: Run, verify pass** → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server && git commit -m "feat(server): GET /tasks month read with recurring expansion"
```

### Task 3.2: `POST /tasks` (create + limit enforcement)

**Files:**
- Modify: `apps/server/src/routes/tasks.ts`
- Create: `apps/server/src/db/limits.ts`, `apps/server/test/tasks-create.test.ts`

**Interfaces:**
- Consumes: `countMonthlyTasks`, `countRecurringTasks`, `insertTask`, `getUserRole`, `PLAN_PERMISSIONS`.
- Produces: `POST /tasks` body `TaskInput` → `{ task }` (200) or `{ error }` (429); `enforceCreate(env, userId, task): Promise<string | null>` (returns an error string or null).

- [ ] **Step 1: Failing tests**

Free user (role stub) at 30 monthly tasks → 429 "Monthly limit reached". Free user creating a
recurring task → 429 "Recurring not allowed on your plan". Under limit → 200 and row present.

- [ ] **Step 2: Run, verify fail** → FAIL

- [ ] **Step 3: Implement `db/limits.ts` + the route**

```ts
// db/limits.ts
import { PLAN_PERMISSIONS, type Task } from "@dailify/shared";
import type { Env } from "../index";
import { getUserRole } from "../lib/clerk";
import { countMonthlyTasks, countRecurringTasks } from "./tasks";

export async function enforceCreate(env: Env, userId: string, task: Task): Promise<string | null> {
  const perms = PLAN_PERMISSIONS[await getUserRole(env, userId)];
  const isRecurring = task.repeat !== "Off";
  if (isRecurring && perms.taskLimits.recurring !== -1) {
    const n = await countRecurringTasks(env.DB, userId);
    if (n >= perms.taskLimits.recurring) return "Recurring Tasks Limit Reached";
  }
  if (perms.taskLimits.monthly !== -1) {
    const n = await countMonthlyTasks(env.DB, userId, new Date(task.date));
    if (n >= perms.taskLimits.monthly) return "Monthly Tasks Limit Reached";
  }
  return null;
}
```
Route (append to `tasks.ts`):
```ts
import { nanoid } from "nanoid";
import { insertTask } from "../db/tasks";
import { enforceCreate } from "../db/limits";
import { normalizeRepeat, type TaskInput } from "@dailify/shared";

tasks.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<TaskInput>();
  const task = {
    id: body.id ?? nanoid(6),
    title: body.title, description: body.description ?? "",
    date: body.date, alert: body.alert, duration: body.duration,
    priority: body.priority ?? 0, repeat: normalizeRepeat(body.repeat),
    tags: body.tags, completed: body.completed ?? [],
  };
  const err = await enforceCreate(c.env, userId, task);
  if (err) return fail(c, 429, err);
  await insertTask(c.env.DB, userId, task);
  return c.json({ task });
});
```
Add `nanoid` dep to the server.

- [ ] **Step 4: Run, verify pass** → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/server && git commit -m "feat(server): POST /tasks with server-side limit enforcement"
```

### Task 3.3: `PATCH /tasks/:id` (edit — no creation-limit charge)

**Files:** Modify `routes/tasks.ts`; Create `test/tasks-edit.test.ts`

**Interfaces:** Consumes `updateTask`. Produces `PATCH /tasks/:id` → `{ task }` (404 if missing).

- [ ] **Step 1: Failing test** — edit an existing task's title returns the updated task; editing while
  at the monthly cap still succeeds (edit must NOT be blocked by creation limits — fixes today's bug).
- [ ] **Step 2: Run, verify fail** → FAIL
- [ ] **Step 3: Implement**
```ts
tasks.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const patch = await c.req.json<Partial<TaskInput>>();
  if (patch.repeat !== undefined) patch.repeat = normalizeRepeat(patch.repeat);
  const updated = await updateTask(c.env.DB, userId, id, patch);
  if (!updated) return fail(c, 404, "Task not found");
  return c.json({ task: updated });
});
```
- [ ] **Step 4: Run, verify pass** → PASS
- [ ] **Step 5: Commit** — `feat(server): PATCH /tasks/:id (edit skips creation limits)`

### Task 3.4: `POST /tasks/:id/complete`

**Files:** Modify `routes/tasks.ts`; Create `test/tasks-complete.test.ts`

**Interfaces:** Consumes `appendCompletion`. Produces `POST /tasks/:id/complete` → `{ task }`.

- [ ] **Step 1: Failing test** — completing appends one epoch-ms entry to `completed`.
- [ ] **Step 2: Run fail** → FAIL
- [ ] **Step 3: Implement** — the endpoint appends `Date.now()`:
```ts
tasks.post("/:id/complete", async (c) => {
  const userId = c.get("userId");
  const updated = await appendCompletion(c.env.DB, userId, c.req.param("id"), Date.now());
  if (!updated) return fail(c, 404, "Task not found");
  return c.json({ task: updated });
});
```
- [ ] **Step 4: Run pass** → PASS
- [ ] **Step 5: Commit** — `feat(server): POST /tasks/:id/complete`

### Task 3.5: `DELETE /tasks/:id`

**Files:** Modify `routes/tasks.ts`; Create `test/tasks-delete.test.ts`

**Interfaces:** Consumes `deleteTask`. Produces `DELETE /tasks/:id` → 204.

- [ ] **Step 1: Failing test** — after delete, the task is gone from a month read.
- [ ] **Step 2: Run fail** → FAIL
- [ ] **Step 3: Implement**
```ts
tasks.delete("/:id", async (c) => {
  await deleteTask(c.env.DB, c.get("userId"), c.req.param("id"));
  return c.body(null, 204);
});
```
- [ ] **Step 4: Run pass** → PASS
- [ ] **Step 5: Commit** — `feat(server): DELETE /tasks/:id`

---

## Phase 4 — Billing & permissions

### Task 4.1: `lib/stripe.ts` + `GET /permissions`

**Files:** Create `apps/server/src/lib/stripe.ts`, `apps/server/src/routes/billing.ts`, `apps/server/test/permissions.test.ts`; Modify `index.ts` (mount billing).

**Interfaces:** Produces `stripeClient(env): Stripe` (fetch http client); `GET /permissions` → `Permissions` from `PLAN_PERMISSIONS[role]`.

- [ ] **Step 1: Failing test** — `GET /permissions` for a free-role stub returns the free matrix entry.
- [ ] **Step 2: Run fail** → FAIL
- [ ] **Step 3: Implement**
```ts
// lib/stripe.ts
import Stripe from "stripe";
import type { Env } from "../index";
export const stripeClient = (env: Env) =>
  new Stripe(env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
```
```ts
// routes/billing.ts
import { Hono } from "hono";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { getUserRole } from "../lib/clerk";
import { PLAN_PERMISSIONS } from "@dailify/shared";

const billing = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
billing.get("/permissions", requireAuth, async (c) =>
  c.json(PLAN_PERMISSIONS[await getUserRole(c.env, c.get("userId"))]));
export default billing;
```
Mount: `app.route("/", billing)` (so the path is `/permissions`), or `app.route("/billing", ...)` for
the rest and a separate `app.get("/permissions", ...)`. Keep `/permissions` at root to match §6.
- [ ] **Step 4: Run pass** → PASS
- [ ] **Step 5: Commit** — `feat(server): Stripe fetch client + GET /permissions`

### Task 4.2: `POST /billing/checkout` + `GET /billing/portal`

**Files:** Modify `routes/billing.ts`, `lib/clerk.ts` (read `stripeCustomerId`); Create `test/checkout.test.ts` (Stripe mocked).

**Interfaces:** Produces `POST /billing/checkout` `{ productName }` → `{ url }` (portal if already subscribed, else new checkout); `GET /billing/portal` → `{ url }`. Price ids resolved from env via a `priceMap`.

- [ ] **Step 1: Failing test** — with Stripe mocked to return a session URL, checkout returns `{ url }`;
  unknown `productName` → 400.
- [ ] **Step 2: Run fail** → FAIL
- [ ] **Step 3: Implement** — build `priceMap` from env (`pro`→`STRIPE_PRICE_PRO`,
  `pro-year`→`STRIPE_PRICE_PRO_YEAR`, `pro+ai`→`STRIPE_PRICE_PROAI`, `pro+ai-year`→`STRIPE_PRICE_PROAI_YEAR`);
  read the user's email + `stripeCustomerId` from Clerk; if an active subscription exists, return a
  billing-portal URL, else create a checkout session (mirror the current server's logic, using
  `stripeClient(c.env)`). Success/cancel URLs use `c.env.ALLOWED_ORIGIN`.
- [ ] **Step 4: Run pass** → PASS
- [ ] **Step 5: Commit** — `feat(server): checkout + billing portal`

### Task 4.3: `GET /billing/payment-details` + `GET /billing/invoices`

**Files:** Modify `routes/billing.ts`; Create `test/invoices.test.ts` (Stripe mocked).

**Interfaces:** Produces the two GETs returning `PaymentDetails` / `Invoice[]` (shared DTOs). Port the
mapping from the current server `PaymentDetails` / `InvoicesList`.

- [ ] Steps 1-5: failing test (mocked Stripe returns fixtures → mapped DTO shape) → fail → implement
  (port logic, `stripeClient(c.env)`, read `stripeCustomerId` from Clerk) → pass → commit
  `feat(server): payment details + invoices list`.

### Task 4.4: `POST /webhooks/stripe` (raw body + async verify)

**Files:** Modify `index.ts` (raw-body route BEFORE any json parsing), `routes/billing.ts` or a new
`routes/webhook.ts`, `lib/clerk.ts` (`updateUserRole`, `updateUserBillingDetails`); Create `test/webhook.test.ts`.

**Interfaces:** Produces `POST /webhooks/stripe` (no auth) handling `invoice.paid`,
`customer.subscription.deleted`, `customer.subscription.updated`; updates Clerk metadata.

- [ ] **Step 1: Failing test** — a signed test event (use `stripe.webhooks.generateTestHeaderString`
  with the test secret, mocked) routes to the right handler; a bad signature → 400.
- [ ] **Step 2: Run fail** → FAIL
- [ ] **Step 3: Implement** — read the raw body via `await c.req.arrayBuffer()` /
  `await c.req.text()` and pass to `stripe.webhooks.constructEventAsync(raw, sig, c.env.STRIPE_WEBHOOK_SECRET)`.
  Port the three event branches; role/billing writes go through `lib/clerk.ts`. Ensure the webhook
  route is registered so no CORS/json middleware consumes the body first.
- [ ] **Step 4: Run pass** → PASS
- [ ] **Step 5: Commit** — `feat(server): Stripe webhook (raw body, async verify)`

---

## Phase 5 — Voice

### Task 5.1: `POST /tasks/voice` (OpenAI, no disk, Pro+AI gated)

**Files:** Create `apps/server/src/lib/openai.ts`, `apps/server/src/routes/voice.ts`, `apps/server/test/voice.test.ts`; Modify `index.ts`.

**Interfaces:** Consumes `getUserRole`, `PLAN_PERMISSIONS`, `enforceCreate`, `insertTask`,
`normalizeRepeat`. Produces `POST /tasks/voice` (multipart `audio`) → `{ tasks: Task[] }`; 403 if not
voice-entitled.

- [ ] **Step 1: Failing test** — a non-voice role → 403; a voice role with OpenAI mocked (transcript +
  a create-intent JSON) inserts tasks and returns them.
- [ ] **Step 2: Run fail** → FAIL
- [ ] **Step 3: Implement**
```ts
// lib/openai.ts
import OpenAI from "openai";
import type { Env } from "../index";
export const openaiClient = (env: Env) => new OpenAI({ apiKey: env.OPENAI_API_KEY });
export async function transcribe(env: Env, file: File): Promise<string> {
  const r = await openaiClient(env).audio.transcriptions.create({ file, model: "whisper-1" });
  return r.text;
}
// plus generateTasks(env, transcript, timezone): returns parsed { tasks: TaskInput[] } (port the GPT prompt)
```
```ts
// routes/voice.ts (essentials)
voice.post("/voice", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = await getUserRole(c.env, userId);
  if (!PLAN_PERMISSIONS[role].features.voiceCreation) return fail(c, 403, "Voice not available on your plan");
  const body = await c.req.parseBody();
  const audio = body["audio"];
  if (!(audio instanceof File)) return fail(c, 400, "No audio");
  const transcript = await transcribe(c.env, audio);
  // timezone from Clerk unsafeMetadata; parse GPT; for each: normalizeRepeat, enforceCreate, insertTask
  // return { tasks }
});
```
Mount `voice` under `/tasks` (so path is `/tasks/voice`). Port the GPT prompt + timezone handling
(Luxon or `Intl`) from the current server; drop `fs`/`handleAudioFiles` entirely.
- [ ] **Step 4: Run pass** → PASS
- [ ] **Step 5: Commit** — `feat(server): POST /tasks/voice (OpenAI, no filesystem, Pro+AI gated)`

---

## Phase 6 — Web cutover (remove Firebase, epoch-ms dates, API client)

### Task 6.1: API client `apps/web/src/functions/api.ts`

**Files:** Create `apps/web/src/functions/api.ts`; Modify `apps/web/src/consts/conts.ts` (add `apiURL` from `import.meta.env.VITE_API_URL`).

**Interfaces:** Produces `getTasksForMonth(token, month): Promise<Task[]>`, `createTask(token, input)`,
`updateTask(token, id, patch)`, `completeTask(token, id)`, `deleteTask(token, id)`,
`createTaskVoice(token, formData)`, `getPermissions(token)`, `getPaymentDetails(token)`,
`getInvoices(token)`, `checkout(token, productName)`, `billingPortal(token)`. All take a Clerk token,
hit `apiURL`, and speak the shared `Task` shape (epoch ms).

- [ ] **Step 1: Write the client**

```ts
import type { Task, TaskInput, Permissions, PaymentDetails, Invoice } from "@dailify/shared";
import { apiURL } from "@/consts/conts";

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
});

export async function getTasksForMonth(token: string, month: Date): Promise<Task[]> {
  const m = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const res = await fetch(`${apiURL}/tasks?month=${m}`, authed(token));
  const data = await res.json();
  return data.tasks ?? [];
}
export async function createTask(token: string, input: TaskInput): Promise<{ task?: Task; error?: string }> {
  const res = await fetch(`${apiURL}/tasks`, authed(token, { method: "POST", body: JSON.stringify(input) }));
  return res.json();
}
export async function updateTask(token: string, id: string, patch: Partial<TaskInput>) {
  const res = await fetch(`${apiURL}/tasks/${id}`, authed(token, { method: "PATCH", body: JSON.stringify(patch) }));
  return res.json();
}
export async function completeTask(token: string, id: string) {
  const res = await fetch(`${apiURL}/tasks/${id}/complete`, authed(token, { method: "POST" }));
  return res.json();
}
export async function deleteTask(token: string, id: string): Promise<void> {
  await fetch(`${apiURL}/tasks/${id}`, authed(token, { method: "DELETE" }));
}
export async function createTaskVoice(token: string, formData: FormData): Promise<Response> {
  return fetch(`${apiURL}/tasks/voice`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
}
export async function getPermissions(token: string): Promise<Permissions> {
  return (await fetch(`${apiURL}/permissions`, authed(token))).json();
}
export async function getPaymentDetails(token: string): Promise<PaymentDetails> {
  return (await fetch(`${apiURL}/billing/payment-details`, authed(token))).json();
}
export async function getInvoices(token: string): Promise<Invoice[]> {
  return (await fetch(`${apiURL}/billing/invoices`, authed(token))).json();
}
export async function checkout(token: string, productName: string): Promise<{ url: string }> {
  return (await fetch(`${apiURL}/billing/checkout`, authed(token, { method: "POST", body: JSON.stringify({ productName }) }))).json();
}
export async function billingPortal(token: string): Promise<{ url: string }> {
  return (await fetch(`${apiURL}/billing/portal`, authed(token))).json();
}
```
`conts.ts`: `export const apiURL = import.meta.env.VITE_API_URL;` (remove `serverURL`).

- [ ] **Step 2: Typecheck** — `bun --filter @dailify/web exec tsc -b` (will still fail until consumers
  switch off `firebase.ts`; that's Tasks 6.2-6.4). Commit the client alone.
- [ ] **Step 3: Commit** — `feat(web): API client (api.ts) speaking the shared Task shape`

### Task 6.2: Switch the model to shared `Task` (epoch-ms) across web

**Files:** Modify `apps/web/src/types/types.ts`, `apps/web/src/functions/functions.ts`,
`apps/web/src/components/dailifyContext.tsx`, `daily-tasks.tsx`, `edit-task.tsx`, `new-task.tsx`,
`select-day.tsx`, `calendar-view.tsx`, `task-preview.tsx`, `new-task-voice.tsx`, `wave-form.tsx`.

**Interfaces:** `TaskProps` becomes `Task` from `@dailify/shared` (re-export for minimal churn:
`export type { Task as TaskProps } from "@dailify/shared";`). `date/alert/completed` are numbers.

- [ ] **Step 1:** In `types.ts`, re-export shared `Task`/`Entitlements`/`Permissions`/`PLAN_ID` and
  keep only the web-only picker prop interfaces. Delete the local `TaskProps` date/Timestamp union and
  the `import { Timestamp } from "firebase/firestore"`.
- [ ] **Step 2:** In `functions.ts`, delete `toJsDate` and the `Timestamp` import. Rewrite the helpers
  to treat dates as numbers: `getTime`/`getCompletionDate`/`getTasksForDay`/`getNextTask`/`isTaskModified`
  use `new Date(task.date)` directly. Move `expandRecurringTask`/`normalizeRepeat`/`computeEntitlements`
  imports to `@dailify/shared` (delete the local copies). Update `functions.test.ts` accordingly (or
  delete the recurrence cases now living in shared).
- [ ] **Step 3:** In components, replace every `task.date instanceof Timestamp ? ... : ...` and
  `(x as Timestamp).toDate()` with `new Date(task.date)`; completion writes push `Date.now()` (a
  number). `daily-tasks.tsx` optimistic complete: `completed: [...task.completed, Date.now()]`.
  `edit-task.tsx` date picker default: `new Date(task.date)`. `new-task.tsx` builds `TaskInput` with
  `date: selectedDate.getTime()` (and `alert` if set). `select-day.tsx`: `format(new Date(nextTask.date), "PPPP, p")`.
- [ ] **Step 4:** `bun --filter @dailify/web exec tsc -b` — expect remaining errors only in
  `firebase.ts`/`protected-route.tsx` (handled next). Run `bun --filter @dailify/web test`.
- [ ] **Step 5: Commit** — `refactor(web): adopt shared Task model (epoch-ms dates); drop Timestamp`

### Task 6.3: Route reads/writes through `api.ts`; delete the Firebase bridge

**Files:** Delete `apps/web/src/functions/firebase.ts`; Modify `protected-route.tsx`, `new-task.tsx`,
`edit-task.tsx`, `daily-tasks.tsx`, `task-preview.tsx`, `new-task-voice.tsx`/`wave-form.tsx`, `profileTabs.tsx`.

**Interfaces:** All data calls now import from `@/functions/api`. `deleteTask(token, id)` (token-based,
not `userId`).

- [ ] **Step 1:** In `protected-route.tsx`, delete both Firebase-bridge effects
  (`signInWithCustomToken`, `onAuthStateChanged`, `onIdTokenChanged`, `isFirebaseLogged`, the `auth`
  import). Reads: `getTasks()` calls `getTasksForMonth(await getToken(), selectedDay)`. Gate loading on
  Clerk (`isLoaded`/`userId`) only. Permissions/payment/invoices use the `api.ts` getters.
- [ ] **Step 2:** Update writers: `new-task.tsx` → `createTask`; `edit-task.tsx` → `updateTask`;
  `daily-tasks.tsx` → `completeTask` + `deleteTask`; `task-preview.tsx` → `deleteTask`;
  voice → `createTaskVoice`. Keep the optimistic `upsertTaskById` pattern against the context array.
- [ ] **Step 3:** `profileTabs.tsx` billing portal → `billingPortal`; usage via `computeEntitlements`
  from shared.
- [ ] **Step 4:** `bun --filter @dailify/web exec tsc -b` → PASS; `bun --filter @dailify/web test` → PASS.
- [ ] **Step 5: Commit** — `refactor(web): reads/writes via api.ts; remove Clerk→Firebase bridge`

### Task 6.4: Remove Firebase entirely; wire pricing page to shared

**Files:** Modify `apps/web/package.json` (drop `firebase`), `login.tsx`, `header.tsx`, `premium.tsx`;
delete any leftover firebase imports.

- [ ] **Step 1:** Remove `signOut(auth)` from `login.tsx` and `header.tsx` (keep Clerk `signOut`).
- [ ] **Step 2:** `premium.tsx` reads limits/features from `PLAN_PERMISSIONS` (e.g. Pro monthly from
  `PLAN_PERMISSIONS.pro.taskLimits.monthly`) instead of the hard-coded "300"; checkout via `api.ts`.
- [ ] **Step 3:** `bun remove firebase` (in `apps/web`). Grep to confirm zero `firebase` imports:
  `rg "firebase" apps/web/src` → no results.
- [ ] **Step 4:** `bun --filter @dailify/web check` → PASS (format+lint+tsc+test).
- [ ] **Step 5: Commit** — `chore(web): remove firebase dependency; pricing page from shared matrix`

---

## Phase 7 — Cleanup

### Task 7.1: Remove Firestore/Firebase infra + dead files

**Files:** Delete `firestore.rules`, `firebase.json`, `.firebaserc` (if at repo root or web), the
committed audio files, and any Firestore-only docs. Update nested `CLAUDE.md` files that describe the
read/write split.

- [ ] **Step 1:** `git rm firestore.rules firebase.json .firebaserc` (wherever they live) and any
  `apps/web/src/**` mentions of the Firestore bridge in `CLAUDE.md` (update `functions/CLAUDE.md`,
  `components/CLAUDE.md`, `consts/CLAUDE.md`, `types/CLAUDE.md` to the D1/api reality).
- [ ] **Step 2:** Ensure the old server's committed service-account JSON is not present anywhere in the
  monorepo (`rg -l "firebase-adminsdk" .` → none).
- [ ] **Step 3:** `bun run check` at root → PASS.
- [ ] **Step 4: Commit** — `chore: remove Firestore infra + stale docs after D1 migration`

---

## Phase 8 — Deploy (manual, documented)

### Task 8.1: Provision D1, set secrets, deploy server, point web

**Not TDD — these are operator steps for the user; record exact commands.**

- [ ] **Step 1: Create the D1 database and fill `wrangler.toml`**
```bash
cd apps/server
bunx wrangler d1 create dailify        # copy database_id into wrangler.toml
bunx wrangler d1 migrations apply dailify --remote
```
- [ ] **Step 2: Set secrets**
```bash
bunx wrangler secret put CLERK_SECRET_KEY
bunx wrangler secret put CLERK_PUBLISHABLE_KEY
bunx wrangler secret put STRIPE_SECRET_KEY
bunx wrangler secret put STRIPE_WEBHOOK_SECRET
bunx wrangler secret put OPENAI_API_KEY
bunx wrangler secret put STRIPE_PRICE_PRO
bunx wrangler secret put STRIPE_PRICE_PRO_YEAR
bunx wrangler secret put STRIPE_PRICE_PROAI
bunx wrangler secret put STRIPE_PRICE_PROAI_YEAR
```
- [ ] **Step 3: Deploy the Worker**
```bash
bunx wrangler deploy      # note the workers.dev URL (or bind a custom domain, e.g. api.dailify.mxrqz.com)
```
- [ ] **Step 4: Configure Stripe webhook** → point it at `POST <worker-url>/webhooks/stripe`; copy the
  signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy if it changed.
- [ ] **Step 5: Point the web app** → in Cloudflare (web project): set root directory `apps/web`,
  build `bun run build`, output `apps/web/dist`; set `VITE_API_URL=<worker-url>` and
  `VITE_CLERK_PUBLISHABLE_KEY` as **build** variables; redeploy. Verify login → home loads tasks →
  create/edit/complete/delete → checkout. Then decommission the Render server.

---

## Self-Review

**Spec coverage:** §3 repo→Task 0.1; §4 shared→1.1-1.3; §5 D1 schema→2.2; §6 API contract→3.1-3.5,
4.1-4.4, 5.1; §7 server→Phase 2-5; §8 pricing→1.2; §9 web→Phase 6; §10 tests→every task's TDD steps;
§11 bugs→2.3 (getUser), 3.3 (edit limit), 2.1/2.2 (CORS/no service-account), 5.1 (no disk), 1.2
(recurrence leak), 7.1 (audio files/service-account); §12 deploy→Task 8.1; §13 phases→1:1; §14 risks→
addressed in 2.1 (nodejs_compat/CLERK_JWT_KEY), 2.2 (D1 test migrations), 4.4 (raw body), 5.1 (upload).

**Placeholders:** the only intentional placeholder is `database_id = "PLACEHOLDER"` in `wrangler.toml`,
filled by `wrangler d1 create` in Task 8.1 — flagged in both places. Billing tasks 4.2/4.3 say "port
logic" pointing at the exact source functions (`CreateCheckoutSession`, `PaymentDetails`, `InvoicesList`
in the old `dailify-server/src/functions/stripe.ts`) rather than re-pasting ~150 lines; the shapes are
pinned by the shared `PaymentDetails`/`Invoice` DTOs.

**Type consistency:** `Task.date` is `number` everywhere; `expandRecurringTask(task, month: Date): Task[]`
consistent shared↔server; `getUserRole`/`enforceCreate`/`insertTask` signatures match across db/limits/routes;
`api.ts` returns shared DTOs consumed by the web components.
