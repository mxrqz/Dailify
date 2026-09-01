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

export async function readAllUsage(db: D1Database, userId: string, at: Date): Promise<QuotaUsage> {
  const entries = await Promise.all(
    QUOTA_KEYS.map(async (key) => [key, await COUNTERS[key](db, userId, at)] as const),
  );
  // Literal com as três chaves, não Record<string, number>: sem "as", uma quota nova sem entrada
  // aqui não compila — o mesmo raciocínio do COUNTERS acima.
  const usage: QuotaUsage = { tasks: 0, recurring: 0, voice: 0 };
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
