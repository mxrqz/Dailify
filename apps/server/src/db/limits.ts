import {
  limitsFor,
  QUOTA_KEYS,
  type QuotaKey,
  type QuotaLimits,
  type QuotaUsage,
  type Role,
  type Task,
} from "@dailify/shared";
import { countMonthlyTasks } from "./tasks";
import { periodFor, readStoredUsage } from "./usage";

type Counter = (db: D1Database, userId: string, at: Date) => Promise<number>;

/** Uma entrada por quota do registro — quota nova sem contador não compila. */
const COUNTERS: Record<QuotaKey, Counter> = {
  tasks: (db, userId, at) => countMonthlyTasks(db, userId, at),
  // `at` é a âncora do que se CONTA: pra `tasks` é a data da tarefa, que varia de propósito. Crédito
  // de IA é ancorado em AGORA — "o mês em que o pedido foi feito" —, então ignora o `at` e lê o mês
  // do servidor; senão o cliente navegando pro mês que vem via o medidor de créditos zerar sozinho.
  ai: (db, userId) => readStoredUsage(db, userId, "ai", periodFor("ai", new Date())),
};

/** Strings de contrato: `tasks-create.test.ts` e o toast do cliente batem nelas. */
const QUOTA_ERRORS: Record<QuotaKey, string> = {
  tasks: "Monthly Tasks Limit Reached",
  ai: "AI Credits Limit Reached",
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

export async function readAllUsage(db: D1Database, userId: string, at: Date): Promise<QuotaUsage> {
  const entries = await Promise.all(
    QUOTA_KEYS.map(async (key) => [key, await COUNTERS[key](db, userId, at)] as const),
  );
  // Literal com todas as chaves, não Record<string, number>: sem "as", uma quota nova sem entrada
  // aqui não compila — o mesmo raciocínio do COUNTERS acima.
  const usage: QuotaUsage = { tasks: 0, ai: 0 };
  for (const [key, used] of entries) usage[key] = used;
  return usage;
}

export async function enforceCreate(
  db: D1Database,
  userId: string,
  role: Role,
  task: Task,
): Promise<string | null> {
  return enforce(db, userId, limitsFor(role), "tasks", new Date(task.date));
}
