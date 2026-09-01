# Quotas Reais Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os booleanos de plano por três quotas numéricas declaradas num registro único, com enforcement e contagem no servidor, e mostrar as três no header.

**Architecture:** Um objeto literal `QUOTAS` em `@dailify/shared` declara cada quota uma vez (escopo + limite por papel). O servidor tem um `Record<QuotaKey, contador>` e a web tem um `Record<QuotaKey, rótulo>`; os dois são cobrados pelo compilador. O registro entra **ao lado** do `PLAN_PERMISSIONS` existente e os consumidores migram um por task — o `bun run check` fica verde do começo ao fim, e a última task apaga o modelo velho.

**Tech Stack:** TypeScript, bun workspaces, Hono + D1 (Cloudflare Workers), React 18 + Vite, Radix Progress, vitest (`@cloudflare/vitest-pool-workers` no server).

**Spec:** `docs/superpowers/specs/2026-08-31-quotas-reais-design.md`

## Global Constraints

- **Sem `as`.** Type guards ou tipos corretos. `as const` e `satisfies` são permitidos. ESLint avisa.
- **Sem valores arbitrários de design.** Nada de `bg-[#151515]` ou `rounded-[17px]`. Tokens em `apps/web/src/global.css`; se não houver token, adicione um (`:root` + `@theme inline`). Espaçamento na escala do Tailwind.
- **Comentário só pro não-óbvio**, uma linha curta explicando POR QUÊ. Nada de JSDoc de 5 linhas narrando o que o código já diz.
- **Prettier**, `printWidth: 100`. Rode `bun --filter '@dailify/web' format` antes de commitar código da web.
- **Gate completo:** `bun run check` (format:check + lint + typecheck + test). Cada task termina com ele verde.
- **Datas são epoch-ms** (`number`) de ponta a ponta.
- **`-1` = ilimitado, `0` = bloqueado.** Convenção já existente, mantida.
- **Tabela de limites, verbatim:**

  | | free | pro | pro+ai | admin |
  | --- | --- | --- | --- | --- |
  | `tasks` | 30 | 300 | -1 | -1 |
  | `recurring` | 3 | 30 | -1 | -1 |
  | `voice` | 3 | 5 | 200 | -1 |

- **Mensagens de erro de quota, verbatim** (as duas primeiras já existem e não podem mudar — há teste em cima):
  - `tasks` → `"Monthly Tasks Limit Reached"`
  - `recurring` → `"Recurring Tasks Limit Reached"`
  - `voice` → `"Voice Limit Reached"`
- **`MAX_AUDIO_BYTES` = 512 KB** (`512 * 1024`).
- **Cap de gravação = 60 segundos.**
- Rodar comandos a partir da raiz do worktree.

---

### Task 1: O registro de quotas em `@dailify/shared`

Nada consome ainda. `PLAN_PERMISSIONS` continua existindo e intocado.

**Files:**
- Create: `packages/shared/src/quotas.ts`
- Create: `packages/shared/src/quotas.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `Role` de `./types`.
- Produces: `QUOTAS`, `QUOTA_KEYS`, `QuotaKey`, `QuotaScope`, `QuotaLimits`, `QuotaUsage`, `QuotaState`, `Quotas`, `limitsFor(role)`, `quotaState(limit, used)`, `computeQuotas(limits, usage)`.

- [ ] **Step 1: Escrever o teste que falha**

Crie `packages/shared/src/quotas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { QUOTAS, QUOTA_KEYS, limitsFor, quotaState, computeQuotas } from "./quotas";

describe("QUOTAS", () => {
  it("declara as três quotas com os limites da tabela", () => {
    expect(QUOTAS.tasks.limits).toEqual({ free: 30, pro: 300, "pro+ai": -1, admin: -1 });
    expect(QUOTAS.recurring.limits).toEqual({ free: 3, pro: 30, "pro+ai": -1, admin: -1 });
    expect(QUOTAS.voice.limits).toEqual({ free: 3, pro: 5, "pro+ai": 200, admin: -1 });
  });

  it("declara o escopo de cada quota", () => {
    expect(QUOTAS.tasks.scope).toBe("month");
    expect(QUOTAS.voice.scope).toBe("month");
    expect(QUOTAS.recurring.scope).toBe("lifetime");
  });

  it("QUOTA_KEYS cobre todas as chaves do registro", () => {
    expect(QUOTA_KEYS).toEqual(Object.keys(QUOTAS));
  });
});

describe("limitsFor", () => {
  it("free", () => {
    expect(limitsFor("free")).toEqual({ tasks: 30, recurring: 3, voice: 3 });
  });
  it("pro", () => {
    expect(limitsFor("pro")).toEqual({ tasks: 300, recurring: 30, voice: 5 });
  });
  it("pro+ai", () => {
    expect(limitsFor("pro+ai")).toEqual({ tasks: -1, recurring: -1, voice: 200 });
  });
  it("admin é ilimitado em tudo", () => {
    expect(limitsFor("admin")).toEqual({ tasks: -1, recurring: -1, voice: -1 });
  });
});

describe("quotaState", () => {
  it("finito no meio", () => {
    expect(quotaState(30, 12)).toEqual({
      limit: 30,
      used: 12,
      remaining: 18,
      unlimited: false,
      blocked: false,
      exhausted: false,
      ratio: 0.4,
    });
  });

  it("finito esgotado", () => {
    const s = quotaState(30, 30);
    expect(s.remaining).toBe(0);
    expect(s.exhausted).toBe(true);
    expect(s.ratio).toBe(1);
  });

  it("finito estourado não passa de 1 nem vai a negativo", () => {
    const s = quotaState(30, 47);
    expect(s.remaining).toBe(0);
    expect(s.ratio).toBe(1);
    expect(s.exhausted).toBe(true);
  });

  it("ilimitado não tem fração", () => {
    const s = quotaState(-1, 47);
    expect(s.unlimited).toBe(true);
    expect(s.blocked).toBe(false);
    expect(s.exhausted).toBe(false);
    expect(s.remaining).toBe(Infinity);
    expect(s.ratio).toBeNull();
  });

  it("bloqueado é cheio e esgotado", () => {
    const s = quotaState(0, 0);
    expect(s.blocked).toBe(true);
    expect(s.unlimited).toBe(false);
    expect(s.exhausted).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.ratio).toBe(1);
  });

  it("zero usado de um limite finito", () => {
    const s = quotaState(30, 0);
    expect(s.ratio).toBe(0);
    expect(s.exhausted).toBe(false);
  });
});

describe("computeQuotas", () => {
  it("combina limites e uso por chave", () => {
    const q = computeQuotas({ tasks: 30, recurring: 3, voice: 3 }, { tasks: 12, recurring: 1, voice: 0 });
    expect(q.loading).toBe(false);
    expect(q.states.tasks.remaining).toBe(18);
    expect(q.states.recurring.remaining).toBe(2);
    expect(q.states.voice.used).toBe(0);
  });

  it("sem limites = carregando, e nada aparece bloqueado", () => {
    const q = computeQuotas(undefined, undefined);
    expect(q.loading).toBe(true);
    for (const key of QUOTA_KEYS) {
      expect(q.states[key].exhausted).toBe(false);
      expect(q.states[key].unlimited).toBe(true);
    }
  });

  it("limites sem uso ainda é carregando", () => {
    expect(computeQuotas({ tasks: 30, recurring: 3, voice: 3 }, undefined).loading).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `bun --filter '@dailify/shared' test`
Expected: FAIL — `Failed to resolve import "./quotas"`.

- [ ] **Step 3: Implementar `quotas.ts`**

Crie `packages/shared/src/quotas.ts`:

```ts
import type { Role } from "./types";

export type QuotaScope = "month" | "lifetime";

/**
 * A declaração única de toda quota do produto. Servidor, cliente, página de preços e medidor do
 * header leem daqui — antes cada um tinha a sua cópia, e a de venda já mentia.
 *
 * `-1` = ilimitado, `0` = bloqueado. `scope` diz contra o quê o uso é contado: `month` reinicia a
 * cada mês-calendário, `lifetime` nunca reinicia.
 */
export const QUOTAS = {
  tasks: { scope: "month", limits: { free: 30, pro: 300, "pro+ai": -1, admin: -1 } },
  recurring: { scope: "lifetime", limits: { free: 3, pro: 30, "pro+ai": -1, admin: -1 } },
  voice: { scope: "month", limits: { free: 3, pro: 5, "pro+ai": 200, admin: -1 } },
} as const satisfies Record<string, { scope: QuotaScope; limits: Record<Role, number> }>;

export type QuotaKey = keyof typeof QUOTAS;

export const QUOTA_KEYS: readonly QuotaKey[] = Object.keys(QUOTAS).filter(isQuotaKey);

function isQuotaKey(value: string): value is QuotaKey {
  return value in QUOTAS;
}

export type QuotaLimits = Record<QuotaKey, number>;
export type QuotaUsage = Record<QuotaKey, number>;

export interface QuotaState {
  limit: number;
  used: number;
  /** `Infinity` quando ilimitado. */
  remaining: number;
  unlimited: boolean;
  blocked: boolean;
  exhausted: boolean;
  /** `null` quando ilimitado: não existe fração de um teto que não existe. É o que a barra lê. */
  ratio: number | null;
}

export interface Quotas {
  loading: boolean;
  states: Record<QuotaKey, QuotaState>;
}

export function limitsFor(role: Role): QuotaLimits {
  return mapKeys((key) => QUOTAS[key].limits[role]);
}

export function quotaState(limit: number, used: number): QuotaState {
  const unlimited = limit < 0;
  const blocked = limit === 0;
  const remaining = unlimited ? Infinity : Math.max(0, limit - used);
  return {
    limit,
    used,
    remaining,
    unlimited,
    blocked,
    exhausted: remaining === 0,
    // Bloqueado desenha cheio: "cheio" já significa "não pode mais", que é exatamente o caso.
    ratio: unlimited ? null : blocked ? 1 : Math.min(1, used / limit),
  };
}

/**
 * Enquanto os limites não chegaram do servidor tudo conta como ilimitado: a UI se esconde pelo
 * `loading`, e o caminho de criação NÃO pode bloquear quem está pagando só porque a resposta
 * atrasou.
 */
export function computeQuotas(
  limits: QuotaLimits | undefined,
  usage: QuotaUsage | undefined,
): Quotas {
  const loading = limits === undefined || usage === undefined;
  return {
    loading,
    states: mapKeys((key) => quotaState(loading ? -1 : limits[key], loading ? 0 : usage[key])),
  };
}

function mapKeys<T>(pick: (key: QuotaKey) => T): Record<QuotaKey, T> {
  const out: Partial<Record<QuotaKey, T>> = {};
  for (const key of QUOTA_KEYS) out[key] = pick(key);
  return fullRecord(out);
}

/** `QUOTA_KEYS` vem de `Object.keys(QUOTAS)`, então o loop acima preencheu todas as chaves. */
function fullRecord<T>(partial: Partial<Record<QuotaKey, T>>): Record<QuotaKey, T> {
  const out: Record<string, T> = {};
  for (const key of QUOTA_KEYS) {
    const value = partial[key];
    if (value === undefined) throw new Error(`quota sem valor: ${key}`);
    out[key] = value;
  }
  return out;
}
```

- [ ] **Step 4: Exportar do índice**

Em `packages/shared/src/index.ts`, adicione a linha depois de `export * from "./pricing";`:

```ts
export * from "./quotas";
```

- [ ] **Step 5: Rodar os testes**

Run: `bun --filter '@dailify/shared' test`
Expected: PASS — todos os testes de `quotas.test.ts` verdes, `pricing.test.ts` intocado e verde.

- [ ] **Step 6: Gate completo**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/quotas.ts packages/shared/src/quotas.test.ts packages/shared/src/index.ts
git commit -m "feat(quotas): registro unico declara as tres quotas e seus escopos

Dailify-5v4"
```

---

### Task 2: Tabela de uso em D1 e leitura/escrita do contador armazenado

Só `voice` precisa de armazenamento — `tasks` e `recurring` saem de `COUNT(*)` sobre `tasks`. A tabela é genérica (`quota` como coluna) porque é o mesmo SQL de uma específica e evita migration por quota futura.

**Files:**
- Create: `apps/server/migrations/0007_usage.sql`
- Create: `apps/server/src/db/usage.ts`
- Create: `apps/server/test/db-usage.test.ts`

**Interfaces:**
- Consumes: `QuotaKey`, `QuotaScope`, `QUOTAS` de `@dailify/shared` (Task 1).
- Produces: `periodFor(key, at): string`, `readStoredUsage(db, userId, key, period): Promise<number>`, `bumpStoredUsage(db, userId, key, period): Promise<void>`.

- [ ] **Step 1: Escrever a migration**

Crie `apps/server/migrations/0007_usage.sql`:

```sql
-- Uso consumido por quota. Só entra aqui o que não dá pra contar da tabela `tasks`: hoje só a voz,
-- que não deixa rastro nenhum depois que a transcrição foi paga.
-- `period` é 'YYYY-MM' para quota de escopo mensal e 'all' para vitalícia — assim a PK serve aos
-- dois escopos sem coluna nula.
CREATE TABLE usage (
  user_id TEXT NOT NULL,
  quota   TEXT NOT NULL,
  period  TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, quota, period)
);
```

- [ ] **Step 2: Escrever o teste que falha**

Crie `apps/server/test/db-usage.test.ts`:

```ts
import { env } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import { applyD1Migrations } from "cloudflare:test";
import { periodFor, readStoredUsage, bumpStoredUsage } from "../src/db/usage";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("periodFor", () => {
  it("quota mensal vira YYYY-MM", () => {
    expect(periodFor("voice", new Date(2026, 7, 31))).toBe("2026-08");
  });

  it("mês de um dígito ganha zero à esquerda", () => {
    expect(periodFor("voice", new Date(2026, 0, 5))).toBe("2026-01");
  });

  it("quota vitalícia não tem período", () => {
    expect(periodFor("recurring", new Date(2026, 7, 31))).toBe("all");
  });
});

describe("db/usage", () => {
  it("lê zero quando nunca houve uso", async () => {
    expect(await readStoredUsage(env.DB, "uz", "voice", "2026-08")).toBe(0);
  });

  it("conta cada bump", async () => {
    await bumpStoredUsage(env.DB, "ua", "voice", "2026-08");
    await bumpStoredUsage(env.DB, "ua", "voice", "2026-08");
    expect(await readStoredUsage(env.DB, "ua", "voice", "2026-08")).toBe(2);
  });

  it("separa por período", async () => {
    await bumpStoredUsage(env.DB, "ub", "voice", "2026-08");
    await bumpStoredUsage(env.DB, "ub", "voice", "2026-09");
    expect(await readStoredUsage(env.DB, "ub", "voice", "2026-08")).toBe(1);
    expect(await readStoredUsage(env.DB, "ub", "voice", "2026-09")).toBe(1);
  });

  it("separa por usuário", async () => {
    await bumpStoredUsage(env.DB, "uc", "voice", "2026-08");
    expect(await readStoredUsage(env.DB, "ud", "voice", "2026-08")).toBe(0);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bun --filter '@dailify/server' test -- db-usage`
Expected: FAIL — `Cannot find module '../src/db/usage'`.

- [ ] **Step 4: Implementar `db/usage.ts`**

Crie `apps/server/src/db/usage.ts`:

```ts
import { QUOTAS, type QuotaKey } from "@dailify/shared";

/** Chave de período da quota: o mês-calendário local, ou 'all' pra quem nunca reinicia. */
export function periodFor(key: QuotaKey, at: Date): string {
  if (QUOTAS[key].scope === "lifetime") return "all";
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
}

export async function readStoredUsage(
  db: D1Database,
  userId: string,
  key: QuotaKey,
  period: string,
): Promise<number> {
  const row = await db
    .prepare(`SELECT count FROM usage WHERE user_id=? AND quota=? AND period=?`)
    .bind(userId, key, period)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function bumpStoredUsage(
  db: D1Database,
  userId: string,
  key: QuotaKey,
  period: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage (user_id, quota, period, count) VALUES (?, ?, ?, 1)
       ON CONFLICT(user_id, quota, period) DO UPDATE SET count = count + 1`,
    )
    .bind(userId, key, period)
    .run();
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bun --filter '@dailify/server' test -- db-usage`
Expected: PASS — 7 testes.

- [ ] **Step 6: Gate completo**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/migrations/0007_usage.sql apps/server/src/db/usage.ts apps/server/test/db-usage.test.ts
git commit -m "feat(quotas): tabela de uso em D1 para quota que nao da pra contar de tasks

Dailify-5v4"
```

---

### Task 3: Enforcement genérico no servidor

`enforceCreate` para de ter um `if` por quota e passa a chamar um `enforce` genérico. **Aqui os limites novos entram em vigor**: free ganha 3 recorrentes, pro cai pra 30.

**Files:**
- Modify: `apps/server/src/db/limits.ts` (arquivo inteiro reescrito)
- Modify: `apps/server/test/tasks-create.test.ts:53-67` (o teste de recorrente do free)
- Create: `apps/server/test/limits.test.ts`

**Interfaces:**
- Consumes: `limitsFor`, `QuotaKey`, `QUOTA_KEYS`, `QuotaLimits` (Task 1); `readStoredUsage`, `periodFor` (Task 2); `countMonthlyTasks`, `countRecurringTasks` de `../db/tasks`.
- Produces: `COUNTERS: Record<QuotaKey, Counter>`, `QUOTA_ERRORS: Record<QuotaKey, string>`, `enforce(db, userId, limits, key, at): Promise<string | null>`, `readAllUsage(db, userId, at): Promise<QuotaUsage>`, `enforceCreate(env, userId, task): Promise<string | null>` (assinatura inalterada).

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/server/test/limits.test.ts`:

```ts
import { env } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import { applyD1Migrations } from "cloudflare:test";
import { limitsFor } from "@dailify/shared";
import { enforce, readAllUsage } from "../src/db/limits";
import { insertTask } from "../src/db/tasks";
import { bumpStoredUsage } from "../src/db/usage";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const task = (over: Partial<Task> = {}): Task => ({
  id: "l1",
  title: "T",
  date: new Date(2026, 5, 10, 9).getTime(),
  duration: "10m",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...over,
});

describe("enforce", () => {
  it("deixa passar quando o limite é ilimitado, sem consultar o banco", async () => {
    const err = await enforce(env.DB, "le1", limitsFor("pro+ai"), "tasks", new Date(2026, 5, 1));
    expect(err).toBeNull();
  });

  it("deixa passar abaixo do limite", async () => {
    await insertTask(env.DB, "le2", task({ id: "le2-a" }));
    const err = await enforce(env.DB, "le2", limitsFor("free"), "tasks", new Date(2026, 5, 1));
    expect(err).toBeNull();
  });

  it("barra no limite exato", async () => {
    for (let i = 0; i < 3; i++) {
      await insertTask(env.DB, "le3", task({ id: `le3-${i}`, repeat: "Daily" }));
    }
    const err = await enforce(env.DB, "le3", limitsFor("free"), "recurring", new Date(2026, 5, 1));
    expect(err).toBe("Recurring Tasks Limit Reached");
  });

  it("conta voz do armazenamento, por mês", async () => {
    for (let i = 0; i < 3; i++) await bumpStoredUsage(env.DB, "le4", "voice", "2026-06");
    expect(await enforce(env.DB, "le4", limitsFor("free"), "voice", new Date(2026, 5, 20))).toBe(
      "Voice Limit Reached",
    );
    // Julho é outro período: a quota reinicia.
    expect(
      await enforce(env.DB, "le4", limitsFor("free"), "voice", new Date(2026, 6, 1)),
    ).toBeNull();
  });
});

describe("readAllUsage", () => {
  it("devolve as três chaves", async () => {
    await insertTask(env.DB, "le5", task({ id: "le5-a" }));
    await insertTask(env.DB, "le5", task({ id: "le5-b", repeat: "Daily" }));
    await bumpStoredUsage(env.DB, "le5", "voice", "2026-06");

    const usage = await readAllUsage(env.DB, "le5", new Date(2026, 5, 15));
    expect(usage).toEqual({ tasks: 2, recurring: 1, voice: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter '@dailify/server' test -- limits`
Expected: FAIL — `enforce` e `readAllUsage` não são exportados de `../src/db/limits`.

- [ ] **Step 3: Reescrever `db/limits.ts`**

Substitua o conteúdo inteiro de `apps/server/src/db/limits.ts` por:

```ts
import {
  limitsFor,
  QUOTA_KEYS,
  type QuotaKey,
  type QuotaLimits,
  type QuotaUsage,
  type Task,
} from "@dailify/shared";
import type { Env } from "../index";
import { getUserRole } from "../lib/clerk";
import { countMonthlyTasks, countRecurringTasks } from "./tasks";
import { periodFor, readStoredUsage } from "./usage";

type Counter = (db: D1Database, userId: string, at: Date) => Promise<number>;

/** Uma entrada por quota do registro — quota nova sem contador não compila. */
const COUNTERS: Record<QuotaKey, Counter> = {
  tasks: (db, userId, at) => countMonthlyTasks(db, userId, at),
  recurring: (db, userId) => countRecurringTasks(db, userId),
  voice: (db, userId, at) => readStoredUsage(db, userId, "voice", periodFor("voice", at)),
};

/** Strings de contrato: `tasks-create.test.ts` e o toast do cliente batem nelas. */
const QUOTA_ERRORS: Record<QuotaKey, string> = {
  tasks: "Monthly Tasks Limit Reached",
  recurring: "Recurring Tasks Limit Reached",
  voice: "Voice Limit Reached",
};

export async function enforce(
  db: D1Database,
  userId: string,
  limits: QuotaLimits,
  key: QuotaKey,
  at: Date,
): Promise<string | null> {
  const limit = limits[key];
  if (limit < 0) return null; // ilimitado: nem vale a query
  const used = await COUNTERS[key](db, userId, at);
  return used >= limit ? QUOTA_ERRORS[key] : null;
}

export async function readAllUsage(
  db: D1Database,
  userId: string,
  at: Date,
): Promise<QuotaUsage> {
  const entries = await Promise.all(
    QUOTA_KEYS.map(async (key) => [key, await COUNTERS[key](db, userId, at)] as const),
  );
  const usage: Record<string, number> = {};
  for (const [key, used] of entries) usage[key] = used;
  return usage;
}

/**
 * Uma leitura de papel só: `getUserRole` bate no Clerk pela rede, e criar uma tarefa recorrente
 * consulta duas quotas.
 */
export async function enforceCreate(env: Env, userId: string, task: Task): Promise<string | null> {
  const limits = limitsFor(await getUserRole(env, userId));
  const at = new Date(task.date);

  if (task.repeat !== "Off") {
    const err = await enforce(env.DB, userId, limits, "recurring", at);
    if (err) return err;
  }
  return enforce(env.DB, userId, limits, "tasks", at);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter '@dailify/server' test -- limits`
Expected: PASS — 5 testes.

- [ ] **Step 5: Consertar o teste que os limites novos quebraram**

`tasks-create.test.ts:53` assume que o free não pode criar **nenhuma** recorrente. Agora pode criar 3. Substitua o bloco inteiro do `it("429s a free user creating a recurring task", ...)` (linhas 53-67) por:

```ts
  it("429s a free user creating a 4th recurring task", async () => {
    role = "free";
    for (let i = 0; i < 3; i++) {
      await insertTask(env.DB, "u2", {
        id: `rec-${i}`,
        title: `R${i}`,
        date: new Date(2026, 6, 1, 9).getTime(),
        duration: "10m",
        priority: 0,
        repeat: "Daily",
        completed: [],
      });
    }
    const res = await app.request(
      "/tasks",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(taskInput({ repeat: "Daily" })),
      },
      env,
    );
    expect(res.status).toBe(429);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Recurring Tasks Limit Reached");
  });
```

- [ ] **Step 6: Rodar a suíte inteira do server**

Run: `bun --filter '@dailify/server' test`
Expected: PASS. Se `tasks-create.test.ts` ainda falhar por contagem de tasks do mês, é porque as recorrentes inseridas no passo 5 entram no mês de julho/2026 e o teste do cap de 30 usa abril/2026 — meses diferentes, não colidem. Qualquer outra falha, leia o erro antes de mexer.

- [ ] **Step 7: Gate completo**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/db/limits.ts apps/server/test/limits.test.ts apps/server/test/tasks-create.test.ts
git commit -m "feat(quotas): enforcement generico le o registro em vez de um if por quota

Free ganha 3 recorrentes e pro cai para 30, entao o teste que assumia
recorrencia zero no free virou 'a quarta e recusada'.

Dailify-5v4"
```

---

### Task 4: Quota e cap de áudio na rota de voz

**Files:**
- Modify: `apps/server/src/routes/voice.ts:38-58`
- Modify: `apps/server/test/voice.test.ts`

**Interfaces:**
- Consumes: `enforce` (Task 3), `bumpStoredUsage`/`periodFor` (Task 2), `limitsFor` (Task 1).
- Produces: nada novo.

- [ ] **Step 1: Escrever os testes que falham**

Em `apps/server/test/voice.test.ts`, adicione ao final do arquivo:

```ts
describe("POST /tasks/voice — quota e tamanho", () => {
  it("recusa áudio acima de 512 KB sem chamar a OpenAI", async () => {
    role = "pro+ai";
    userId = "vq1";
    const form = new FormData();
    form.append(
      "audio",
      new File([new Uint8Array(512 * 1024 + 1)], "audio.ogg", { type: "audio/ogg" }),
    );
    const res = await app.request("/tasks/voice", { method: "POST", body: form }, env);
    expect(res.status).toBe(413);
    expect(openaiMock.audio.transcriptions.create).not.toHaveBeenCalled();
  });

  it("429s quando a quota mensal de voz acabou", async () => {
    role = "free";
    userId = "vq2";
    getUserMock.mockResolvedValue({ id: "vq2", unsafeMetadata: { timezone: "UTC" } });
    for (let i = 0; i < 3; i++) {
      await bumpStoredUsage(env.DB, "vq2", "voice", periodFor("voice", new Date()));
    }
    const res = await audioRequest();
    expect(res.status).toBe(429);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("Voice Limit Reached");
    expect(openaiMock.audio.transcriptions.create).not.toHaveBeenCalled();
  });

  it("conta o comando mesmo quando a geração não cria tarefa", async () => {
    role = "free";
    userId = "vq3";
    getUserMock.mockResolvedValue({ id: "vq3", unsafeMetadata: { timezone: "UTC" } });
    openaiMock.audio.transcriptions.create.mockResolvedValue({ text: "quais sao minhas tarefas" });
    openaiMock.responses.create.mockResolvedValue({
      output_text: JSON.stringify({ response: "ok", type: "list", listDate: "2026-08-01T00:00:00" }),
    });

    const res = await audioRequest();
    expect(res.status).toBe(200);
    const period = periodFor("voice", new Date());
    expect(await readStoredUsage(env.DB, "vq3", "voice", period)).toBe(1);
  });
});
```

E adicione os imports no topo do arquivo, junto dos que já existem:

```ts
import { bumpStoredUsage, periodFor, readStoredUsage } from "../src/db/usage";
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter '@dailify/server' test -- voice`
Expected: FAIL — o cap ainda é 5 MB (o primeiro teste devolve 200 ou 400, não 413) e nada incrementa `usage`.

- [ ] **Step 3: Reescrever o começo da rota**

Em `apps/server/src/routes/voice.ts`, troque os imports de `PLAN_PERMISSIONS` e `enforceCreate`:

```ts
import { limitsFor, normalizeRepeat, type Task } from "@dailify/shared";
```

```ts
import { enforce, enforceCreate } from "../db/limits";
import { bumpStoredUsage, periodFor } from "../db/usage";
```

Substitua o corpo entre `const userId = c.get("userId");` e `const user = await clerk(...)` por:

```ts
  const userId = c.get("userId");
  const limits = limitsFor(await getUserRole(c.env, userId));
  const now = new Date();

  const quotaError = await enforce(c.env.DB, userId, limits, "voice", now);
  if (quotaError) {
    // Bloqueado (limite 0) e esgotado são a mesma resposta: em ambos não há comando disponível.
    return fail(c, limits.voice === 0 ? 403 : 429, quotaError);
  }

  const body = await c.req.parseBody();
  const audio = body["audio"];
  if (!(audio instanceof File)) return fail(c, 400, "No audio");

  // 60s a 24 kbps = ~180 KB; 512 KB dá folga pro AAC do Safari. Este é o teto de custo por comando:
  // a transcrição é cobrada por minuto de áudio, e sem ele um upload cabia ~28 minutos.
  // ponytail: byte é proxy de duração. Uma request forjada pode encodar ~8 min a 8 kbps aqui
  // dentro; quem fecha a conta é a quota mensal, não este cap sozinho.
  const MAX_AUDIO_BYTES = 512 * 1024;
  if (audio.size > MAX_AUDIO_BYTES) return fail(c, 413, "Audio too large (max 512KB)");
  if (audio.type && !audio.type.startsWith("audio/")) return fail(c, 415, "Unsupported audio type");
```

- [ ] **Step 4: Incrementar depois da transcrição**

Ainda em `voice.ts`, troque a linha `const transcript = await transcribe(c.env, audio);` por:

```ts
  const transcript = await transcribe(c.env, audio);
  // Conta aqui, não no fim: a transcrição é o que custa dinheiro. Se a geração falhar depois, o
  // comando já foi pago.
  await bumpStoredUsage(c.env.DB, userId, "voice", periodFor("voice", now));
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bun --filter '@dailify/server' test -- voice`
Expected: PASS nos três novos, e FAIL no antigo `"403s a non-voice role without calling OpenAI"` (linhas 55-58) — com `pro` tendo 5 comandos, nenhum papel da tabela tem voz bloqueada. **Apague esse teste inteiro.** Não o substitua por uma versão fraca (`expect(status).not.toBe(403)` não prova nada): a condição que ele cobria não existe mais em plano nenhum, e o caminho `blocked` continua testado em `quotaState(0, 0)` (Task 1).

- [ ] **Step 6: Rodar de novo**

Run: `bun --filter '@dailify/server' test`
Expected: PASS.

- [ ] **Step 7: Gate completo**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/server/src/routes/voice.ts apps/server/test/voice.test.ts
git commit -m "feat(quotas): voz tem quota mensal e cap de 512KB por comando

O cap de 5MB deixava passar ~28min de audio numa request (\$0.084). 512KB e o
teto de 60s a 24kbps. A quota conta depois da transcricao, que e onde o
dinheiro sai.

Dailify-5v4"
```

---

### Task 5: `/permissions` devolve limites e uso

**Files:**
- Modify: `apps/server/src/routes/billing.ts:22-24`
- Modify: `apps/server/test/permissions.test.ts`

**Interfaces:**
- Consumes: `limitsFor` (Task 1), `readAllUsage` (Task 3).
- Produces: resposta `{ limits: QuotaLimits, usage: QuotaUsage }` em `GET /permissions?month=YYYY-MM`.

- [ ] **Step 1: Escrever o teste que falha**

Substitua o `describe` inteiro em `apps/server/test/permissions.test.ts` por:

```ts
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("GET /permissions", () => {
  // Janeiro/2026 é um mês em que nenhum teste deste arquivo escreve: a asserção de zeros não
  // depende da ordem em que os testes rodam.
  it("devolve limites e uso do papel", async () => {
    const res = await app.request("/permissions?month=2026-01", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ limits: unknown; usage: unknown }>();
    expect(body.limits).toEqual(limitsFor("free"));
    expect(body.usage).toEqual({ tasks: 0, recurring: 0, voice: 0 });
  });

  it("conta o uso do mês pedido", async () => {
    await insertTask(env.DB, "u1", {
      id: "pm1",
      title: "T",
      date: new Date(2026, 2, 10, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });

    const march = await app.request("/permissions?month=2026-03", {}, env);
    expect((await march.json<{ usage: { tasks: number } }>()).usage.tasks).toBe(1);

    const april = await app.request("/permissions?month=2026-04", {}, env);
    expect((await april.json<{ usage: { tasks: number } }>()).usage.tasks).toBe(0);
  });

  it("mês inválido cai no mês corrente em vez de estourar", async () => {
    const res = await app.request("/permissions?month=banana", {}, env);
    expect(res.status).toBe(200);
  });
});
```

E troque os imports do arquivo (mantendo os dois `vi.mock` do topo, que continuam necessários):

```ts
import { describe, it, expect, beforeAll, vi } from "vitest";
import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { limitsFor } from "@dailify/shared";
import { insertTask } from "../src/db/tasks";
import app from "../src/index";
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter '@dailify/server' test -- permissions`
Expected: FAIL — a resposta ainda é a matriz crua de `PLAN_PERMISSIONS`.

- [ ] **Step 3: Reescrever a rota**

Em `apps/server/src/routes/billing.ts`, troque o import de `PLAN_PERMISSIONS`:

```ts
import { limitsFor } from "@dailify/shared";
```

e adicione, junto dos imports de `../lib/...`:

```ts
import { readAllUsage } from "../db/limits";
```

Substitua o handler de `/permissions` (linhas 22-24) por:

```ts
/**
 * O mês vem do cliente porque quota de escopo mensal é contada contra o mês que ele está olhando —
 * a agenda de agosto tem as suas 30 vagas, setembro tem outras 30.
 */
function monthParam(value: string | undefined): Date {
  const match = value === undefined ? null : /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return new Date();
  return new Date(year, month - 1, 1);
}

billing.get("/permissions", requireAuth, async (c) => {
  const userId = c.get("userId");
  const at = monthParam(c.req.query("month"));
  return c.json({
    limits: limitsFor(await getUserRole(c.env, userId)),
    usage: await readAllUsage(c.env.DB, userId, at),
  });
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun --filter '@dailify/server' test -- permissions`
Expected: PASS — 3 testes.

- [ ] **Step 5: Gate completo**

Run: `bun run check`
Expected: PASS. O typecheck da web ainda passa: `getPermissions` tipa a resposta como `Permissions`, e nada valida o shape em runtime — a web só quebra de verdade na Task 6, que é onde ela é consertada.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/billing.ts apps/server/test/permissions.test.ts
git commit -m "feat(quotas): /permissions devolve limites e uso do mes pedido

O cliente nao tem como contar voz sozinho: nao sobra registro nenhum no que ele
baixa. O uso das tres passa a vir junto das permissoes.

Dailify-5v4"
```

---

### Task 6: A web lê limites e uso do servidor

A contagem local de tarefas morre aqui, e com ela o bug do "0/30" quando o mês não carregou.

**Files:**
- Modify: `apps/web/src/functions/api.ts:185-188`
- Modify: `apps/web/src/components/dailifyContext.tsx`
- Modify: `apps/web/src/components/protected-route.tsx:37-60`
- Modify: `apps/web/src/pages/home.tsx:76` e `:108-132`
- Modify: `apps/web/src/components/dashboard/task-form.tsx:184`
- Modify: `apps/web/src/components/dashboard/task-meta-menus.tsx:111`
- Modify: `apps/web/src/components/wave-form.tsx:56-66`
- Delete: `apps/web/src/hooks/useEntitlements.ts`
- Create: `apps/web/src/hooks/useQuotas.ts`
- Modify: `apps/web/src/types/types.ts`

**`useEntitlements` tem QUATRO consumidores, não um.** Rode
`grep -rn "useEntitlements" apps/web/src` antes de começar e confirme a lista: `billing.tsx:54`,
`home.tsx:76`, `task-form.tsx:184`, `task-meta-menus.tsx:111`. Os três últimos destructuram campos
(`canCreateTask`, `recurrence`) e não aparecem num grep pela palavra "entitlements" em minúsculas —
foi assim que escaparam do levantamento. Deixar qualquer um deles para trás quebra o build.

**Interfaces:**
- Consumes: `computeQuotas`, `Quotas`, `QuotaKey`, `QuotaLimits`, `QuotaUsage` (Task 1); `GET /permissions?month=` (Task 5).
- Produces: `QuotaSnapshot = { limits: QuotaLimits; usage: QuotaUsage }`; `useQuotas(): Quotas`; contexto com `quotas`, `setQuotas`, `bumpUsage(key)`.

- [ ] **Step 1: Trocar o cliente HTTP**

Em `apps/web/src/functions/api.ts`, substitua `getPermissions` (linhas 185-188) por:

```ts
export interface QuotaSnapshot {
  limits: QuotaLimits;
  usage: QuotaUsage;
}

export async function getQuotas(token: string, month: Date): Promise<QuotaSnapshot | undefined> {
  const m = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const { data } = await request<QuotaSnapshot>(`/permissions?month=${m}`, token);
  return data;
}
```

Troque o import de `Permissions` no topo do arquivo por `QuotaLimits, QuotaUsage` (mantenha os outros tipos que já vinham de `@dailify/shared`).

- [ ] **Step 2: Trocar o contexto**

Em `apps/web/src/components/dailifyContext.tsx`:

- Troque as duas linhas de `permissions` na interface por:

```ts
  quotas: QuotaSnapshot | undefined;
  setQuotas: (quotas: QuotaSnapshot) => void;
  /** Incremento otimista: sem ele a barra só se moveria no próximo fetch. */
  bumpUsage: (key: QuotaKey) => void;
```

- Troque o `useState` de `permissions` por:

```ts
  const [quotas, setQuotas] = useState<QuotaSnapshot>();

  const bumpUsage = (key: QuotaKey) =>
    setQuotas((current) =>
      current ? { ...current, usage: { ...current.usage, [key]: current.usage[key] + 1 } } : current,
    );
```

- No `value={{ ... }}`, troque `permissions, setPermissions` por `quotas, setQuotas, bumpUsage`.
- Ajuste os imports: fora `PermissionsProps`, entram `import type { QuotaKey } from "@dailify/shared";` e `import type { QuotaSnapshot } from "@/functions/api";`.

- [ ] **Step 3: Buscar quotas por mês no `protected-route`**

Em `apps/web/src/components/protected-route.tsx`:

- Troque o import `getPermissions` por `getQuotas`.
- Em `const { ... setPermissions, ... }`, troque por `setQuotas`.
- Remova `getPermissions(token)` do `Promise.allSettled` e o bloco `if (permissions.status === ...)`, deixando o `allSettled` com dois elementos:

```ts
        const [payment, invoices] = await Promise.allSettled([
          getPaymentDetails(token),
          getInvoices(token),
        ]);

        if (payment.status === "fulfilled") setPaymentDetails(payment.value);
        if (invoices.status === "fulfilled") setInvoices(invoices.value);
```

- Adicione um efeito próprio logo abaixo dele. Quota de escopo mensal muda com o mês olhado, então este efeito depende do mês — os outros dados, não:

```ts
  // `quotas` fica undefined se a API falhou — `computeQuotas` trata isso como "ainda carregando",
  // que é o comportamento seguro: a UI se esconde e a criação não é bloqueada.
  useEffect(() => {
    if (!isLoaded || !userId) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const snapshot = await getQuotas(token, selectedDay);
        if (snapshot) setQuotas(snapshot);
      } catch {
        /* sem sessão utilizável */
      }
    })();
  }, [isLoaded, userId, selectedDay.getFullYear(), selectedDay.getMonth()]);
```

Se `selectedDay` não estiver desestruturado nesse componente, pegue-o do `useDailify()` que já é chamado ali.

- [ ] **Step 4: Substituir o hook**

Delete `apps/web/src/hooks/useEntitlements.ts` e crie `apps/web/src/hooks/useQuotas.ts`:

```ts
import { useDailify } from "@/components/dailifyContext";
import { computeQuotas, type Quotas } from "@dailify/shared";

/**
 * Fonte única do gating de UI. Limites E uso vêm do servidor — o cliente contava tarefas do array
 * carregado, o que dava "0/30" toda vez que o mês não tinha carregado.
 * Lembre: isto é UX. Quem recusa de verdade é o servidor.
 */
export function useQuotas(): Quotas {
  const { quotas } = useDailify();
  return computeQuotas(quotas?.limits, quotas?.usage);
}
```

- [ ] **Step 5: Incrementar otimista ao criar**

Em `apps/web/src/pages/home.tsx`, pegue `bumpUsage` do `useDailify()` (linha 75) e chame-o logo depois do `setTasks(upsertTaskById(previous, task));` do caminho de sucesso (linha ~132):

```ts
      setTasks(upsertTaskById(previous, task));
      bumpUsage("tasks");
      if (task.repeat !== "Off") bumpUsage("recurring");
```

Em `apps/web/src/components/wave-form.tsx`, pegue `bumpUsage` do `useDailify()` e chame-o em `handleSendRequest`, logo depois de `const data = await response.json();` e do guard `if (!data)`:

```ts
    bumpUsage("voice");
```

- [ ] **Step 5b: Migrar os outros três consumidores do hook antigo**

Os campos derivados mudam de nome porque o modelo mudou de forma. As duas equivalências são exatas:

| antes | agora | por que é o mesmo |
| --- | --- | --- |
| `canCreateTask` | `!quotas.states.tasks.exhausted` | `exhausted` é `remaining === 0`, e ilimitado tem `remaining: Infinity` |
| `recurrence` | `!quotas.states.recurring.blocked` | `blocked` é `limit === 0`, que era exatamente o antigo `recurringLimit !== 0` negado |

- `apps/web/src/pages/home.tsx:76` — troque `const { canCreateTask } = useEntitlements();` por:

```ts
  const quotas = useQuotas();
  const canCreateTask = !quotas.states.tasks.exhausted;
```

- `apps/web/src/components/dashboard/task-form.tsx:184` — troque `const { recurrence } = useEntitlements();` por:

```ts
  const recurrence = !useQuotas().states.recurring.blocked;
```

- `apps/web/src/components/dashboard/task-meta-menus.tsx:111` — a mesma troca da linha acima.

Em cada um dos três, troque também o import de `@/hooks/useEntitlements` por `@/hooks/useQuotas`.

- [ ] **Step 6: Limpar o re-export de tipo**

Em `apps/web/src/types/types.ts`, remova as linhas `Entitlements,` e `Permissions as PermissionsProps,` do bloco de re-export.

- [ ] **Step 7: Rodar e ver passar**

Run: `bun run check`
Expected: FAIL no typecheck de `apps/web/src/pages/billing.tsx`, que ainda importa `useEntitlements`. Este é o único ponto do plano em que a web fica vermelha entre tasks. Feche-a com o remendo mínimo abaixo — a Task 9 reescreve a seção inteira.

Em `billing.tsx`, troque o import e a chamada do hook:

```ts
import { useQuotas } from "@/hooks/useQuotas";
```

```ts
  const quotas = useQuotas();
  const taskQuota = quotas.states.tasks;
```

E, no bloco de uso, troque as quatro leituras:

- `!entitlements.loading` → `!quotas.loading`
- `entitlements.tasksUsed` → `taskQuota.used`
- `entitlements.unlimited ? copy.profile.billingUnlimited : entitlements.monthlyLimit` → `taskQuota.unlimited ? copy.profile.billingUnlimited : taskQuota.limit`
- o `value` do `<Progress>` → `taskQuota.ratio === null ? 0 : taskQuota.ratio * 100`
- `entitlements.remaining` → `taskQuota.remaining`

- [ ] **Step 8: Formatar**

Run: `bun --filter '@dailify/web' format`

- [ ] **Step 9: Gate completo**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src
git commit -m "feat(quotas): a web le limites e uso do servidor, nao conta mais localmente

O contador local vinha do array de tasks do mes carregado, entao offline ou com
erro de rede a barra dizia 0/30. As tres quotas passam a vir do /permissions,
com incremento otimista na criacao.

Dailify-5v4"
```

---

### Task 7: A página de preços itera o registro

Esta é a task que fecha o bug do problema 3 do spec: hoje `planFeatures()` só gera bullet quando o limite é `-1`, então free e pro parariam de anunciar recorrência.

**Files:**
- Modify: `apps/web/src/components/pricing/plan-cards.tsx:11-23`
- Modify: `apps/web/src/components/pricing/copy.ts`
- Create: `apps/web/src/components/pricing/plan-cards.test.ts`

**Interfaces:**
- Consumes: `limitsFor`, `QUOTA_KEYS`, `QuotaKey` (Task 1).
- Produces: `planFeatures(role): string[]` (assinatura inalterada).

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/src/components/pricing/plan-cards.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { planFeatures } from "./plan-cards";

describe("planFeatures", () => {
  it("anuncia recorrência no free — o bullet que o if por quota escondia", () => {
    expect(planFeatures("free")).toContain("3 tarefas recorrentes");
  });

  it("anuncia recorrência no pro", () => {
    expect(planFeatures("pro")).toContain("30 tarefas recorrentes");
  });

  it("anuncia voz em todos os planos", () => {
    expect(planFeatures("free")).toContain("3 comandos de voz/mês");
    expect(planFeatures("pro")).toContain("5 comandos de voz/mês");
    expect(planFeatures("pro+ai")).toContain("200 comandos de voz/mês");
  });

  it("ilimitado usa a frase de ilimitado, não um número", () => {
    expect(planFeatures("pro+ai")).toContain("Tarefas ilimitadas");
    expect(planFeatures("pro+ai")).toContain("Recorrência ilimitada");
  });

  it("cada plano lista uma linha por quota", () => {
    expect(planFeatures("free")).toHaveLength(3);
    expect(planFeatures("pro+ai")).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun --filter '@dailify/web' test -- plan-cards`
Expected: FAIL — `planFeatures("free")` devolve só `["30 tarefas/mês"]`.

- [ ] **Step 3: Reescrever a copy**

Em `apps/web/src/components/pricing/copy.ts`, substitua o bloco `features` inteiro por:

```ts
  /** Uma frase por quota, em duas versões. Quota sem frase não compila. */
  features: {
    finite: {
      tasks: "{n} tarefas/mês",
      recurring: "{n} tarefas recorrentes",
      voice: "{n} comandos de voz/mês",
    } satisfies Record<QuotaKey, string>,
    unlimited: {
      tasks: "Tarefas ilimitadas",
      recurring: "Recorrência ilimitada",
      voice: "Comandos de voz ilimitados",
    } satisfies Record<QuotaKey, string>,
  },
```

Adicione no topo do arquivo:

```ts
import type { QuotaKey } from "@dailify/shared";
```

No mesmo arquivo, corrija as descrições que a tabela nova tornou falsas:

- `plans.pro.description`: `"Mais tarefas por mês e recorrência ilimitada pra quem já vive no Dailify."` → `"Dez vezes mais tarefas e dez vezes mais recorrência pra quem já vive no Dailify."`
- `plans["pro+ai"].description`: `"Tudo do Pro, mais criação de tarefa por voz."` → `"Tarefas e recorrência sem teto, e voz de sobra pra criar falando."`
- `page.subtitle`: `"Mais tarefas por mês, recorrência ilimitada e criação por voz."` → `"Todos os planos têm tudo. O que muda é quanto cabe."`
- Ajuste o docblock do topo: onde diz `PLAN_PERMISSIONS`, passe a dizer `QUOTAS`.

- [ ] **Step 4: Reescrever `planFeatures`**

Em `apps/web/src/components/pricing/plan-cards.tsx`, troque o import de `PLAN_PERMISSIONS`:

```ts
import { limitsFor, QUOTA_KEYS, formatPrice, yearlySavings } from "@dailify/shared";
```

e substitua a função inteira (docblock incluso) por:

```ts
/**
 * Bullets derivados do registro de quotas — a página de venda não pode prometer o que o servidor
 * não entrega, nem calar o que entrega. Limite `0` não vira bullet: é ausência de recurso.
 */
export function planFeatures(role: PlanRole): string[] {
  const limits = limitsFor(role);
  return QUOTA_KEYS.filter((key) => limits[key] !== 0).map((key) =>
    limits[key] < 0
      ? copy.features.unlimited[key]
      : copy.features.finite[key].replace("{n}", String(limits[key])),
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bun --filter '@dailify/web' test -- plan-cards`
Expected: PASS — 5 testes.

- [ ] **Step 6: Formatar e gate**

Run: `bun --filter '@dailify/web' format && bun run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/pricing
git commit -m "fix(quotas): a pagina de precos itera o registro em vez de um if por quota

planFeatures() so gerava bullet quando o limite era -1, entao com free=3 e
pro=30 recorrentes a vitrine pararia de anunciar recorrencia nesses planos.
As descricoes que prometiam 'recorrencia ilimitada' no pro foram junto.

Dailify-5v4"
```

---

### Task 8: O medidor no header

**Files:**
- Create: `apps/web/src/functions/quota-label.ts`
- Create: `apps/web/src/functions/quota-label.test.ts`
- Create: `apps/web/src/components/quota-bar.tsx`
- Modify: `apps/web/src/components/app-header.tsx`
- Modify: `apps/web/src/components/dashboard/copy.ts`

**Interfaces:**
- Consumes: `useQuotas` (Task 6), `QUOTA_KEYS`, `QuotaKey`, `QuotaState` (Task 1), `Progress` de `@/components/ui/progress`.
- Produces: `QuotaBar` (componente), `quotaLabel(state, name, unlimitedWord): string` em `@/functions/quota-label`.

**Por que a função pura sai do componente:** o vitest da web roda em `environment: "node"`, sem DOM.
Importar um `.tsx` que puxa `react-router-dom` e `lucide-react` só pra testar uma função de string é
risco de graça. `apps/web/src/functions/` é o lugar dos helpers puros e testados por convenção do
repo, e `functions/repeat-label.ts` já é exatamente isto: um rotulador que importa `copy`.

- [ ] **Step 1: Adicionar a copy**

Em `apps/web/src/components/dashboard/copy.ts`, adicione uma seção nova no nível de `header`:

```ts
  quota: {
    names: {
      tasks: "Tarefas",
      recurring: "Recorrentes",
      voice: "Voz",
    } satisfies Record<QuotaKey, string>,
    /** `{used} de {limit} {name}` — `{limit}` vira a palavra de ilimitado quando não há teto. */
    summary: "{used} de {limit} {name}",
    unlimited: "ilimitado",
  },
```

Adicione o import no topo: `import type { QuotaKey } from "@dailify/shared";`

- [ ] **Step 2: Escrever o teste que falha**

Crie `apps/web/src/functions/quota-label.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { quotaState } from "@dailify/shared";
import { quotaLabel } from "./quota-label";

describe("quotaLabel", () => {
  it("finito mostra os dois números", () => {
    expect(quotaLabel(quotaState(30, 12), "Tarefas", "ilimitado")).toBe("12 de 30 Tarefas");
  });

  it("ilimitado troca o teto pela palavra, e ainda diz quanto foi usado", () => {
    expect(quotaLabel(quotaState(-1, 47), "Tarefas", "ilimitado")).toBe("47 de ilimitado Tarefas");
  });

  it("bloqueado mostra zero de zero", () => {
    expect(quotaLabel(quotaState(0, 0), "Voz", "ilimitado")).toBe("0 de 0 Voz");
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bun --filter '@dailify/web' test -- quota-label`
Expected: FAIL — `Failed to resolve import "./quota-label"`.

- [ ] **Step 4: Implementar o rotulador e o componente**

Crie `apps/web/src/functions/quota-label.ts`:

```ts
import type { QuotaState } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";

export function quotaLabel(state: QuotaState, name: string, unlimitedWord: string): string {
  return copy.quota.summary
    .replace("{used}", String(state.used))
    .replace("{limit}", state.unlimited ? unlimitedWord : String(state.limit))
    .replace("{name}", name);
}
```

Crie `apps/web/src/components/quota-bar.tsx`:

```tsx
import { ListTodoIcon, RepeatIcon, SparklesIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { QUOTA_KEYS, type QuotaKey } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Progress } from "@/components/ui/progress";
import { quotaLabel } from "@/functions/quota-label";
import { useQuotas } from "@/hooks/useQuotas";
import { cn } from "@/lib/utils";

/** Um ícone por quota — quota nova sem ícone não compila. */
const ICONS: Record<QuotaKey, typeof ListTodoIcon> = {
  tasks: ListTodoIcon,
  recurring: RepeatIcon,
  voice: SparklesIcon,
};

/**
 * As três quotas na barra do app. `ratio === null` (ilimitado) vira `value={null}` no Radix, que
 * deixa o trilho vazio: não existe fração de um teto que não existe, e desenhar 0% ou 100% mentiria.
 */
export function QuotaBar(): JSX.Element | null {
  const quotas = useQuotas();
  if (quotas.loading) return null;

  return (
    <div className="hidden items-center gap-3 md:flex">
      {QUOTA_KEYS.map((key) => {
        const state = quotas.states[key];
        const Icon = ICONS[key];
        const label = quotaLabel(state, copy.quota.names[key], copy.quota.unlimited);

        return (
          <Link
            key={key}
            to="/premium"
            title={label}
            aria-label={label}
            className="inline-flex items-center gap-1.5"
          >
            <Icon
              className={cn("size-3 text-muted-foreground", state.exhausted && "text-destructive")}
              aria-hidden="true"
            />
            <Progress
              value={state.ratio === null ? null : state.ratio * 100}
              className="h-1 w-8"
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bun --filter '@dailify/web' test -- quota-label`
Expected: PASS — 3 testes.

- [ ] **Step 6: Pendurar no header**

Em `apps/web/src/components/app-header.tsx`, adicione o import:

```ts
import { QuotaBar } from "@/components/quota-bar";
```

e coloque o componente como primeiro filho do grupo `ml-auto`, antes do `<SyncBadge />`:

```tsx
      <div className="ml-auto inline-flex items-center gap-2">
        <QuotaBar />

        <SyncBadge />
```

- [ ] **Step 7: Verificar no app**

Run: `bun run dev`
Abra `/dashboard` numa conta free. Esperado: três pares ícone + barra à esquerda do botão Assinar; passar o mouse mostra "N de M Tarefas". Em janela menor que `md` o grupo some. Feche o servidor depois.

- [ ] **Step 8: Formatar e gate**

Run: `bun --filter '@dailify/web' format && bun run check`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/functions/quota-label.ts apps/web/src/functions/quota-label.test.ts apps/web/src/components/quota-bar.tsx apps/web/src/components/app-header.tsx apps/web/src/components/dashboard/copy.ts
git commit -m "feat(quotas): medidor das tres quotas na barra do app

Ilimitado nao vira 0% nem 100%: ratio null deixa o trilho vazio, porque nao
existe fracao de um teto que nao existe.

Dailify-5v4"
```

---

### Task 9: A página de cobrança lista as três

**Files:**
- Modify: `apps/web/src/pages/billing.tsx:136-165`
- Modify: `apps/web/src/components/dashboard/copy.ts`

**Interfaces:**
- Consumes: `useQuotas` (Task 6), `quotaLabel` (Task 8), `QUOTA_KEYS`.
- Produces: nada novo.

- [ ] **Step 1: Substituir a seção de uso**

Em `apps/web/src/pages/billing.tsx`, troque o bloco `{!entitlements.loading && (...)}` inteiro (o `div.space-y-2` com o `Progress` e o parágrafo de restantes) por:

```tsx
            {!quotas.loading && (
              <div className="space-y-4">
                {QUOTA_KEYS.map((key) => {
                  const state = quotas.states[key];
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{copy.quota.names[key]}</span>
                        <span className="font-medium">
                          {state.used} /{" "}
                          {state.unlimited ? copy.quota.unlimited : state.limit}
                        </span>
                      </div>

                      <Progress
                        value={state.ratio === null ? null : state.ratio * 100}
                        className="h-2"
                        aria-label={quotaLabel(state, copy.quota.names[key], copy.quota.unlimited)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
```

Troque `const entitlements = useEntitlements();` por `const quotas = useQuotas();` e ajuste os imports:

```ts
import { QUOTA_KEYS } from "@dailify/shared";
import { quotaLabel } from "@/functions/quota-label";
import { useQuotas } from "@/hooks/useQuotas";
```

- [ ] **Step 2: Remover a copy que ficou órfã**

Em `apps/web/src/components/dashboard/copy.ts`, apague as quatro linhas que só a seção antiga usava:

```
billingTasksUsed, billingUnlimited, billingUnlimitedTasks, billingRemaining
```

Se `bun run check` reclamar que alguma delas ainda é usada, é um consumidor que este plano não previu — leia o erro e resolva ali, não reponha a string.

- [ ] **Step 3: Verificar no app**

Run: `bun run dev`
Abra `/billing`. Esperado: três linhas rotuladas (Tarefas, Recorrentes, Voz), cada uma com `usado / limite` e barra; no plano com quota ilimitada a linha mostra a palavra e o trilho fica vazio.

- [ ] **Step 4: Formatar e gate**

Run: `bun --filter '@dailify/web' format && bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/billing.tsx apps/web/src/components/dashboard/copy.ts
git commit -m "feat(quotas): /billing lista as tres quotas em vez de so tarefas

Dailify-5v4"
```

---

### Task 10: Cap de 60 segundos na gravação

Metade de UX do teto de custo. O enforcement é o cap de bytes da Task 4 — este só evita que o usuário honesto fale 10 minutos e perca tudo num 413.

**Files:**
- Modify: `apps/web/src/components/wave-form.tsx:26-36`
- Modify: `apps/web/src/components/dashboard/copy.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: nada novo.

- [ ] **Step 1: Adicionar a copy**

Em `apps/web/src/components/dashboard/copy.ts`, dentro da seção `voice`, adicione:

```ts
    maxLength: "Gravação encerrada no limite de 60 segundos.",
```

- [ ] **Step 2: Implementar o cap**

Em `apps/web/src/components/wave-form.tsx`, adicione um ref junto dos outros:

```ts
  const capRef = useRef<ReturnType<typeof setTimeout>>();
```

Substitua `startRecording` e `stopRecording` pelo bloco abaixo, **nesta ordem** — `stopRecording` primeiro, porque `startRecording` o referencia e o ESLint reclama de uso antes da definição:

```ts
  // 60s é o teto de custo por comando: a transcrição é cobrada por minuto de áudio. O servidor
  // recusa acima de 512 KB de qualquer jeito — parar aqui evita perder a gravação inteira no 413.
  const MAX_RECORDING_MS = 60_000;

  const stopRecording = async () => {
    if (!recordRef.current) return;
    clearTimeout(capRef.current);
    recordRef.current.stopRecording();
    setIsRecording(false);
  };

  const startRecording = async () => {
    if (!recordRef.current) return;
    await recordRef.current.startRecording();
    setIsRecording(true);
    capRef.current = setTimeout(() => {
      void stopRecording();
      toast.message(copy.voice.maxLength);
    }, MAX_RECORDING_MS);
  };
```

Adicione o import do toast, se ainda não houver: `import { toast } from "sonner";`

No `useEffect` de cleanup que já faz `wavesurfer.destroy()`, adicione `clearTimeout(capRef.current);` antes do destroy — um timer pendente disparando depois do unmount chamaria `setState` num componente morto.

- [ ] **Step 3: Verificar no app**

Run: `bun run dev`
Abra a gravação por voz, comece a gravar e espere 60 segundos sem parar. Esperado: a gravação para sozinha, o toast aparece, e o áudio gravado fica disponível pra enviar (o botão vira o de enviar).

- [ ] **Step 4: Formatar e gate**

Run: `bun --filter '@dailify/web' format && bun run check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wave-form.tsx apps/web/src/components/dashboard/copy.ts
git commit -m "feat(quotas): gravacao para sozinha em 60s

O gravador nao tinha limite nenhum: com o cap antigo de 5MB dava pra mandar
~28min de audio numa request. O enforcement e o cap de bytes no servidor; isto
evita perder a gravacao inteira num 413.

Dailify-5v4"
```

---

### Task 11: Apagar o modelo velho

Nada mais consome `PLAN_PERMISSIONS`, `Permissions`, `Entitlements` nem `computeEntitlements`. Enquanto eles existirem, o próximo a mexer aqui tem duas fontes da verdade pra escolher.

**Files:**
- Modify: `packages/shared/src/pricing.ts`
- Modify: `packages/shared/src/pricing.test.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/CLAUDE.md`
- Modify: `apps/server/CLAUDE.md:31-33`
- Modify: `apps/web/src/types/CLAUDE.md:17-22`
- Modify: `apps/web/src/pages/CLAUDE.md:33-34`
- Modify: `CLAUDE.md:94-95` (raiz)

**Interfaces:**
- Consumes: nada.
- Produces: `pricing.ts` fica só com preço (`PLAN_PRICING`, `PRICING_CURRENCY`, `formatPrice`, `yearlySavings`, `PlanRole`).

- [ ] **Step 1: Confirmar que ninguém usa**

Run: `grep -rn "PLAN_PERMISSIONS\|computeEntitlements\|Entitlements\|PermissionsProps" apps packages --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: nenhuma linha fora de `packages/shared/src/pricing.ts`, `packages/shared/src/pricing.test.ts` e `packages/shared/src/types.ts`. Se aparecer outra, migre-a antes de seguir.

- [ ] **Step 2: Apagar do `pricing.ts`**

Em `packages/shared/src/pricing.ts`, remova `PLAN_PERMISSIONS`, `computeEntitlements` e o import de `Permissions`/`Role`/`Entitlements` no topo. O arquivo fica com `PlanRole`, `PLAN_PRICING`, `PRICING_CURRENCY`, `formatPrice` e `yearlySavings`.

- [ ] **Step 3: Apagar do `types.ts`**

Em `packages/shared/src/types.ts`, remova as interfaces `Permissions` e `Entitlements`. `Role` e `PLAN_ID` ficam.

- [ ] **Step 4: Apagar os testes órfãos**

Em `packages/shared/src/pricing.test.ts`, remova os dois `describe` (`PLAN_PERMISSIONS` e `computeEntitlements`) e o import deles. Se o arquivo ficar sem nenhum teste, apague o arquivo — a cobertura de preço de verdade é `apps/server/test/pricing-stripe.test.ts`.

- [ ] **Step 4b: Corrigir os `CLAUDE.md` que descrevem o modelo apagado**

Cinco arquivos de instrução documentam `PLAN_PERMISSIONS`, `computeEntitlements`, `Permissions` e
`Entitlements`. Eles são carregados no contexto de todo agente que trabalhar aqui depois — descrevendo
símbolos que não existem mais, eles não ficam só desatualizados, eles desinstruem. Corrija os cinco:

**`packages/shared/CLAUDE.md`** — na lista de `src/`, troque a linha de `types.ts` (tire `Permissions`
e `Entitlements`) e a de `pricing.ts` (fica só preço), e acrescente:

```markdown
- **`quotas.ts`** — `QUOTAS` (o registro), `limitsFor`, `quotaState`, `computeQuotas`.
```

Nos invariantes, substitua o bullet de tiering e o de `computeEntitlements` por:

```markdown
- **Quota é declarada uma vez, em `QUOTAS`.** `limitsFor(role)` → `{ tasks, recurring, voice }`;
  **`-1` = ilimitado, `0` = bloqueado**. Servidor e web iteram `QUOTA_KEYS` — nunca nomeiam quota a
  quota, e nunca decidem pela string do plano. Quota nova sem contador (servidor) ou sem rótulo
  (web) é erro de compilação.
- **`computeQuotas(undefined, …)`** = ainda carregando: tudo conta como ilimitado, então a UI se
  esconde pelo `loading` e a criação não trava. Vale porque nenhum plano tem limite `0`; se algum
  voltar a ter, o default precisa voltar a ser por quota.
```

**`apps/server/CLAUDE.md:31-33`** — troque `enforceCreate` reads `PLAN_PERMISSIONS` por:

```markdown
- **Tiering is enforced here, not on the client.** `enforce`/`enforceCreate` (`db/limits.ts`) read
  `limitsFor(role)` (`@dailify/shared`) and count through `COUNTERS`, one per quota; `-1` = unlimited,
  `0` = blocked. The client gate is cosmetic — this is the real one (epic `d69`).
```

**`apps/web/src/types/CLAUDE.md:17-22`** — a seção `PermissionsProps` inteira sai. Troque por:

```markdown
## Quotas — o contrato de tiering

Os limites e o uso vêm do servidor em `GET /permissions?month=YYYY-MM` e são lidos por `useQuotas()`.
Gate a UI em `states[key].blocked` / `.exhausted`, nunca no nome do plano. O registro é `QUOTAS`
(`@dailify/shared`), o mesmo import dos dois lados.
```

**`apps/web/src/pages/CLAUDE.md:33-34`** — troque `PLAN_PERMISSIONS` por `limitsFor` na frase sobre
copy que referencia limites.

**`CLAUDE.md` da raiz, linha 94-95** — troque `tiering PermissionsProps` por `tiering via QUOTAS`.

- [ ] **Step 5: Gate completo**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared CLAUDE.md apps/server/CLAUDE.md apps/web/src/types/CLAUDE.md apps/web/src/pages/CLAUDE.md
git commit -m "refactor(quotas): PLAN_PERMISSIONS e computeEntitlements saem

O registro em quotas.ts e a fonte unica; deixar os dois modelos vivos so daria
ao proximo uma escolha errada pra fazer.

Dailify-5v4"
```

---

### Task 12: Fechar a issue e empurrar

- [ ] **Step 1: Rodar o gate uma última vez**

Run: `bun run check`
Expected: PASS.

- [ ] **Step 2: Confirmar que a migration é a única pendente**

Run: `ls apps/server/migrations/`
Expected: `0007_usage.sql` presente. Ela é aplicada em produção com `wrangler d1 migrations apply dailify --remote` — **não rode isso agora**, é passo de deploy e precisa da confirmação do dono do projeto.

- [ ] **Step 3: Fechar a issue**

```bash
bd close Dailify-5v4
```

- [ ] **Step 4: Empurrar**

```bash
git pull --rebase
git push
git status
```
Expected: `up to date with origin`.

---

## Notas de execução

**O que fica de fora de propósito:**

- `Dailify-v3e` (recorrente antiga ocupando vaga pra sempre) continua aberta. O `scope: "lifetime"` do registro declara o comportamento; não o corrige.
- Sem grandfathering: recorrentes cai de ∞ pra 30 no pro. Não há assinantes.
- O layout do header (ícone + barra, número no tooltip) é provisório por decisão do dono do projeto — refinar depois, não é dívida escondida.

**Onde a coisa pode dar errado:**

- **Task 6 é a única que deixa a web vermelha no meio.** O passo 7 tem o remendo mínimo em `billing.tsx` pra fechar a task verde; a Task 9 faz a versão de verdade.
- **`readD1Migrations` pega a migration nova sozinho** (`apps/server/vitest.config.ts`), então nenhum teste precisa registrar `0007` à mão.
- **As strings de erro de quota são contrato.** `"Monthly Tasks Limit Reached"` e `"Recurring Tasks Limit Reached"` têm teste em cima e aparecem em toast pro usuário. Não reescreva.
