import { Hono } from "hono";
import type { AppEnv, Env } from "../index";
import { requireTaskAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import {
  readMonth,
  getUndatedTasks,
  insertTask,
  updateTask,
  appendCompletion,
  removeCompletions,
  deleteTask,
  detachOccurrence,
  excludeOccurrence,
  pullTasks,
} from "../db/tasks";
import { isRecord, type OccurrenceEdit, type Task, type TaskSync } from "@dailify/shared";
import {
  encodeCursor,
  isEpochMs,
  parseCursor,
  newTaskId,
  parseClientId,
  parseMonth,
  parseNewTask,
  parseOccurrence,
  parseTaskFields,
  readJson,
  validZone,
} from "../lib/task-input";
import { fail } from "../lib/errors";
import { linkedTask, propagate } from "../integrations/propagate";
import { linkInstance } from "../integrations/google-calendar";
import { syncIfDue } from "../integrations/google-calendar/sync";
import { pollGithub } from "../integrations/github";
import { isGoogleTask } from "../integrations/google-calendar/tasks";

const tasks = new Hono<AppEnv>();
tasks.use("*", requireTaskAuth);
tasks.use("*", rateLimit("API_LIMITER"));

tasks.get("/", async (c) => {
  const userId = c.get("userId");
  const month = parseMonth(c.req.query("month"));
  if (!month) return fail(c, 400, "month required");

  // O fuso vem do cliente pelo mesmo motivo que o `from`/`to` do DELETE /complete: o Worker roda em
  // UTC e não tem como saber onde o dia do usuário começa. Sem `tz` o comportamento é o antigo.
  const timeZone = validZone(c.req.query("tz"));
  // A Agenda entra no fundo (throttle de 60 s): o que ela trouxer aparece na próxima leitura.
  c.executionCtx.waitUntil(syncIfDue(c.env, userId));
  c.executionCtx.waitUntil(pollGithub(c.env, userId));

  return c.json({ tasks: await readMonth(c.env.DB, userId, month, timeZone) });
});

tasks.get("/sync", async (c) => {
  const userId = c.get("userId");
  const zone = validZone(c.req.query("tz")) ?? "UTC";
  c.executionCtx.waitUntil(syncIfDue(c.env, userId));
  c.executionCtx.waitUntil(pollGithub(c.env, userId));
  const { next, ...pull } = await pullTasks(
    c.env.DB,
    userId,
    parseCursor(c.req.query("since")),
    zone,
  );
  return c.json({ ...pull, cursor: encodeCursor(next) } satisfies TaskSync);
});

tasks.get("/undated", async (c) =>
  c.json({ tasks: await getUndatedTasks(c.env.DB, c.get("userId")) }),
);

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
  const task: Task = { ...parsed.task, id: clientId ?? newTaskId() };
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

  const linked = await linkedTask(c.env, userId, id);

  // ?occurrence=<epoch-ms> = "editar só esta": edita a instância daquele dia em vez da série.
  // Série na Agenda: a tarefa destacada vira a instância daquele dia (vínculo próprio + override),
  // e a data fica fora do EXDATE do evento. Sem isso a ocorrência sumiria do Google.
  const at = parseOccurrence(c.req.query("occurrence"));
  if (at === "invalid") return fail(c, 400, "invalid occurrence");
  if (at !== undefined) {
    const detached = await detachOccurrence(c.env.DB, userId, id, at, parsed.fields, newTaskId());
    if (!detached) return fail(c, 404, "Recurring task not found");
    if (linked) {
      const ctx = { env: c.env, userId };
      const instances = await Promise.all(
        linked.links
          .filter((l) => l.provider === "google-calendar" && l.timeZone && !isGoogleTask(l))
          .map((l) => linkInstance(ctx, l, linked.before, detached.task, at)),
      );
      c.executionCtx.waitUntil(
        Promise.all([
          propagate(c.env, userId, linked.links, linked.before, detached.series),
          propagate(c.env, userId, instances, null, detached.task),
        ]),
      );
    }
    return c.json(detached satisfies OccurrenceEdit);
  }

  const updated = await updateTask(c.env.DB, userId, id, parsed.fields);
  if (!updated) return fail(c, 404, "Task not found");
  if (linked)
    c.executionCtx.waitUntil(propagate(c.env, userId, linked.links, linked.before, updated));
  return c.json({ task: updated });
});

// Completion reaches only Google Tasks: a done event is still the appointment it was, and a
// series' completions are history, not its rule or dates.
async function linkedGoogleTask(env: Env, userId: string, id: string) {
  const linked = await linkedTask(env, userId, id);
  const links = linked?.links.filter(isGoogleTask) ?? [];
  return linked && links.length ? { ...linked, links } : null;
}

tasks.post("/:id/complete", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  // `at` opcional: uma conclusão feita offline aconteceu quando o cliente diz, não quando a fila
  // subiu. Sem corpo (o caminho online normal), vale o relógio do servidor.
  const body = await readJson(c);
  const at = isRecord(body) && isEpochMs(body.at) ? body.at : Date.now();
  const linked = await linkedGoogleTask(c.env, userId, id);
  const updated = await appendCompletion(c.env.DB, userId, id, at);
  if (!updated) return fail(c, 404, "Task not found");
  if (linked)
    c.executionCtx.waitUntil(propagate(c.env, userId, linked.links, linked.before, updated));
  return c.json({ task: updated });
});

tasks.delete("/:id/complete", async (c) => {
  const from = Number(c.req.query("from"));
  const to = Number(c.req.query("to"));
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from)
    return fail(c, 400, "invalid range");

  const userId = c.get("userId");
  const id = c.req.param("id");
  const linked = await linkedGoogleTask(c.env, userId, id);
  const updated = await removeCompletions(c.env.DB, userId, id, from, to);
  if (!updated) return fail(c, 404, "Task not found");
  if (linked)
    c.executionCtx.waitUntil(propagate(c.env, userId, linked.links, linked.before, updated));
  return c.json({ task: updated });
});

tasks.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const linked = await linkedTask(c.env, userId, id);

  // Mesmo contrato do PATCH: ?occurrence=<epoch-ms> mexe num dia só, sem ?occurrence apaga a série.
  const at = parseOccurrence(c.req.query("occurrence"));
  if (at === "invalid") return fail(c, 400, "invalid occurrence");
  if (at !== undefined) {
    const series = await excludeOccurrence(c.env.DB, userId, id, at);
    if (!series) return fail(c, 404, "Recurring task not found");
    if (linked)
      c.executionCtx.waitUntil(propagate(c.env, userId, linked.links, linked.before, series));
    return c.json({ series } satisfies OccurrenceEdit);
  }

  const updatedAt = parseOccurrence(c.req.query("updatedAt"));
  if (updatedAt === "invalid") return fail(c, 400, "invalid updatedAt");
  // 204 either way: a stale delete that lost to a newer edit is done, and the task comes back on
  // the next read.
  const deleted = await deleteTask(c.env.DB, userId, id, updatedAt);
  if (linked && deleted)
    c.executionCtx.waitUntil(propagate(c.env, userId, linked.links, linked.before, null));
  return c.body(null, 204);
});

export default tasks;
