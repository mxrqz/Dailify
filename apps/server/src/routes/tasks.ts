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
  deleteTask,
  detachOccurrence,
} from "../db/tasks";
import { enforceCreate } from "../db/limits";
import { expandRecurringTask, type Task } from "@dailify/shared";
import { parseNewTask, parseTaskFields } from "../lib/task-input";
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
  const parsed = parseNewTask(await readJson(c));
  if ("error" in parsed) return fail(c, 400, parsed.error);

  // id sempre do servidor: o PK do D1 e global, entao id vindo do cliente colide entre contas.
  const task: Task = { ...parsed.task, id: nanoid(6) };
  const err = await enforceCreate(c.env, userId, task);
  if (err) return fail(c, 429, err);
  await insertTask(c.env.DB, userId, task);
  return c.json({ task });
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
  const updated = await appendCompletion(c.env.DB, userId, c.req.param("id"), Date.now());
  if (!updated) return fail(c, 404, "Task not found");
  return c.json({ task: updated });
});

tasks.delete("/:id", async (c) => {
  await deleteTask(c.env.DB, c.get("userId"), c.req.param("id"));
  return c.body(null, 204);
});

export default tasks;
