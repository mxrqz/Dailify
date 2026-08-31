import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import {
  getMonthTasks,
  getRecurringTasks,
  insertTask,
  updateTask,
  appendCompletion,
  removeCompletions,
  deleteTask,
  detachOccurrence,
} from "../db/tasks";
import { enforceCreate } from "../db/limits";
import { expandRecurringTask, type Task } from "@dailify/shared";
import { parseClientId, parseNewTask, parseTaskFields } from "../lib/task-input";
import { fail } from "../lib/errors";

const tasks = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
tasks.use("*", requireAuth);
tasks.use("*", rateLimit("API_LIMITER"));

const MONTH_RE = /^\d{4}-\d{2}$/;

async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return undefined; // body vazio ou JSON quebrado cai na validacao como "invalid body"
  }
}

tasks.get("/", async (c) => {
  const userId = c.get("userId");
  const monthParam = c.req.query("month"); // "YYYY-MM"
  if (!monthParam || !MONTH_RE.test(monthParam)) return fail(c, 400, "month required");
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

tasks.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await readJson(c);
  const parsed = parseNewTask(body);
  if ("error" in parsed) return fail(c, 400, parsed.error);

  // O id pode vir do cliente: é o que permite à fila offline reenviar a criação sem duplicar a
  // tarefa que já está na tela. A PK do D1 é global, mas o upsert só grava quando a linha é da
  // MESMA conta — colisão entre contas não sobrescreve nada, e vira 409 aqui embaixo.
  const clientId = parseClientId(body);
  if (clientId === "invalid") return fail(c, 400, "invalid id");
  const task: Task = { ...parsed.task, id: clientId ?? nanoid(6) };
  const err = await enforceCreate(c.env, userId, task);
  if (err) return fail(c, 429, err);
  // Devolve o que ficou GRAVADO: numa reentrada da fila o upsert pode ter recusado a escrita por
  // ser mais velha que a linha, e o cliente precisa reconciliar com a versão do servidor.
  const stored = await insertTask(c.env.DB, userId, task);
  if (!stored) return fail(c, 409, "id already in use");
  return c.json({ task: stored });
});

tasks.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const parsed = parseTaskFields(await readJson(c), { partial: true });
  if ("error" in parsed) return fail(c, 400, parsed.error);

  // ?occurrence=<epoch-ms> = "editar só esta": edita a instância daquele dia em vez da série.
  const occurrence = c.req.query("occurrence");
  if (occurrence !== undefined) {
    const at = Number(occurrence);
    if (!Number.isInteger(at)) return fail(c, 400, "invalid occurrence");
    const detached = await detachOccurrence(c.env.DB, userId, id, at, parsed.fields, nanoid(6));
    if (!detached) return fail(c, 404, "Recurring task not found");
    return c.json(detached); // { task, series }
  }

  const updated = await updateTask(c.env.DB, userId, id, parsed.fields);
  if (!updated) return fail(c, 404, "Task not found");
  return c.json({ task: updated });
});

tasks.post("/:id/complete", async (c) => {
  const userId = c.get("userId");
  // `at` opcional: uma conclusão feita offline aconteceu quando o cliente diz, não quando a fila
  // subiu. Sem corpo (o caminho online normal), vale o relógio do servidor.
  const body = await c.req.json<{ at?: number }>().catch(() => ({ at: undefined }));
  const at = Number.isFinite(body.at) && body.at ? body.at : Date.now();
  const updated = await appendCompletion(c.env.DB, userId, c.req.param("id"), at);
  if (!updated) return fail(c, 404, "Task not found");
  return c.json({ task: updated });
});

tasks.delete("/:id/complete", async (c) => {
  const from = Number(c.req.query("from"));
  const to = Number(c.req.query("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from)
    return fail(c, 400, "invalid range");

  const updated = await removeCompletions(c.env.DB, c.get("userId"), c.req.param("id"), from, to);
  if (!updated) return fail(c, 404, "Task not found");
  return c.json({ task: updated });
});

tasks.delete("/:id", async (c) => {
  await deleteTask(c.env.DB, c.get("userId"), c.req.param("id"));
  return c.body(null, 204);
});

export default tasks;
