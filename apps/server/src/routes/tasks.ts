import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import {
  getMonthTasks,
  getRecurringTasks,
  insertTask,
  updateTask,
  appendCompletion,
  deleteTask,
} from "../db/tasks";
import { enforceCreate } from "../db/limits";
import { expandRecurringTask, normalizeRepeat, type Task, type TaskInput } from "@dailify/shared";
import { fail } from "../lib/errors";

const tasks = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
tasks.use("*", requireAuth);

const MONTH_RE = /^\d{4}-\d{2}$/;
const MAX_LINKS = 10;

/**
 * `undefined` = campo nao veio (ou veio null); "invalid" = veio e nao presta. O painel renderiza
 * esses links como <a href>, entao protocolo fora de http(s) aqui vira XSS refletido na propria
 * tela. Credencial embutida (https://user:pass@host) tambem cai fora: e o padrao classico de
 * spoofing (https://paypal.com@evil.com aparenta paypal.com mas o host real e evil.com) e o
 * detector do cliente (parse-links.ts) explicitamente deixa essa checagem pro servidor.
 */
function sanitizeLinks(value: unknown): string[] | undefined | "invalid" {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > MAX_LINKS) return "invalid";

  const urls: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !URL.canParse(item)) return "invalid";
    const { protocol, username, password } = new URL(item);
    if (protocol !== "http:" && protocol !== "https:") return "invalid";
    if (username || password) return "invalid";
    urls.push(item);
  }
  return urls.length ? urls : undefined;
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
  const body = await c.req.json<TaskInput>();
  const links = sanitizeLinks(body.links);
  if (links === "invalid") return fail(c, 400, "invalid links");
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
    links,
    completed: body.completed ?? [],
  };
  const err = await enforceCreate(c.env, userId, task);
  if (err) return fail(c, 429, err);
  await insertTask(c.env.DB, userId, task);
  return c.json({ task });
});

tasks.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const patch = await c.req.json<Partial<TaskInput>>();
  if (patch.repeat !== undefined) patch.repeat = normalizeRepeat(patch.repeat);
  if (patch.links !== undefined) {
    const links = sanitizeLinks(patch.links);
    if (links === "invalid") return fail(c, 400, "invalid links");
    patch.links = links;
  }
  const updated = await updateTask(c.env.DB, userId, id, patch);
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
