import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { getMonthTasks, getRecurringTasks, insertTask } from "../db/tasks";
import { enforceCreate } from "../db/limits";
import { expandRecurringTask, normalizeRepeat, type Task, type TaskInput } from "@dailify/shared";
import { fail } from "../lib/errors";

const tasks = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
tasks.use("*", requireAuth);

const MONTH_RE = /^\d{4}-\d{2}$/;

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
  const body = await c.req.json<TaskInput>();
  const task: Task = {
    id: body.id ?? nanoid(6),
    title: body.title,
    description: body.description ?? "",
    date: body.date,
    alert: body.alert,
    duration: body.duration,
    priority: body.priority ?? 0,
    repeat: normalizeRepeat(body.repeat),
    tags: body.tags,
    completed: body.completed ?? [],
  };
  const err = await enforceCreate(c.env, userId, task);
  if (err) return fail(c, 429, err);
  await insertTask(c.env.DB, userId, task);
  return c.json({ task });
});

export default tasks;
