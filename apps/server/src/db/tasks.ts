import type { Task, Repeat } from "@dailify/shared";
import { startOfMonthMs, endOfMonthMs } from "@dailify/shared";

interface Row {
  id: string;
  user_id: string;
  title: string;
  date: number;
  alert: number | null;
  duration: string;
  priority: number;
  repeat_kind: string;
  repeat_days: string | null;
  tags: string | null;
  links: string | null;
  completed: string;
  exdates: string | null;
}

function repeatToCols(repeat: Repeat): { kind: string; days: string | null } {
  if (typeof repeat === "string") return { kind: repeat, days: null };
  return { kind: "Weekly", days: JSON.stringify(repeat.Weekly) };
}

// Linha corrompida no D1 (por qualquer caminho) tem que virar campo vazio na leitura, nao crash.
function safeParse(json: string | null): unknown {
  if (!json) return undefined;
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

function stringArray(json: string | null): string[] | undefined {
  const value = safeParse(json);
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((v): v is string => typeof v === "string");
  return items.length ? items : undefined;
}

function numberArray(json: string | null): number[] {
  const value = safeParse(json);
  return Array.isArray(value) ? value.filter((v): v is number => typeof v === "number") : [];
}

function colsToRepeat(kind: string, days: string | null): Repeat {
  if (kind === "Weekly") return { Weekly: stringArray(days) ?? [] };
  if (kind === "Daily" || kind === "Monthly" || kind === "Yearly") return kind;
  return "Off";
}

export function rowToTask(r: Row): Task {
  return {
    id: r.id,
    title: r.title,
    date: r.date,
    alert: r.alert ?? undefined,
    duration: r.duration,
    priority: r.priority,
    repeat: colsToRepeat(r.repeat_kind, r.repeat_days),
    tags: stringArray(r.tags),
    links: stringArray(r.links),
    completed: numberArray(r.completed),
    exdates: r.exdates ? numberArray(r.exdates) : undefined,
  };
}

function insertStatement(db: D1Database, userId: string, task: Task): D1PreparedStatement {
  const { kind, days } = repeatToCols(task.repeat);
  return db
    .prepare(
      `INSERT INTO tasks (id,user_id,title,date,alert,duration,priority,repeat_kind,repeat_days,tags,links,completed)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      task.id,
      userId,
      task.title,
      task.date,
      task.alert ?? null,
      task.duration,
      task.priority,
      kind,
      days,
      task.tags ? JSON.stringify(task.tags) : null,
      task.links ? JSON.stringify(task.links) : null,
      JSON.stringify(task.completed),
    );
}

export async function insertTask(db: D1Database, userId: string, task: Task): Promise<Task> {
  await insertStatement(db, userId, task).run();
  return task;
}

export async function getMonthTasks(db: D1Database, userId: string, month: Date): Promise<Task[]> {
  const { results } = await db
    .prepare(`SELECT * FROM tasks WHERE user_id=? AND date>=? AND date<=?`)
    .bind(userId, startOfMonthMs(month), endOfMonthMs(month))
    .all<Row>();
  return results.map(rowToTask);
}

export async function getRecurringTasks(db: D1Database, userId: string): Promise<Task[]> {
  const { results } = await db
    .prepare(`SELECT * FROM tasks WHERE user_id=? AND repeat_kind!='Off'`)
    .bind(userId)
    .all<Row>();
  return results.map(rowToTask);
}

export async function countMonthlyTasks(
  db: D1Database,
  userId: string,
  month: Date,
): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND date>=? AND date<=?`)
    .bind(userId, startOfMonthMs(month), endOfMonthMs(month))
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function countRecurringTasks(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) as n FROM tasks WHERE user_id=? AND repeat_kind!='Off'`)
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getTask(db: D1Database, userId: string, id: string): Promise<Task | null> {
  const r = await db
    .prepare(`SELECT * FROM tasks WHERE user_id=? AND id=?`)
    .bind(userId, id)
    .first<Row>();
  return r ? rowToTask(r) : null;
}

export async function deleteTask(db: D1Database, userId: string, id: string): Promise<void> {
  await db.prepare(`DELETE FROM tasks WHERE user_id=? AND id=?`).bind(userId, id).run();
}

/** Tudo que o usuário tem no D1 — chamado pelo webhook `user.deleted` do Clerk. */
export async function deleteUserData(db: D1Database, userId: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM tasks WHERE user_id=?`).bind(userId),
    db.prepare(`DELETE FROM push_subscriptions WHERE user_id=?`).bind(userId),
  ]);
}

export async function appendCompletion(
  db: D1Database,
  userId: string,
  id: string,
  at: number,
): Promise<Task | null> {
  const task = await getTask(db, userId, id);
  if (!task) return null;
  const completed = [...task.completed, at];
  await db
    .prepare(`UPDATE tasks SET completed=? WHERE user_id=? AND id=?`)
    .bind(JSON.stringify(completed), userId, id)
    .run();
  return { ...task, completed };
}

/**
 * "Editar só esta ocorrência": a instância vira tarefa própria (sem recorrência) e a data original
 * entra no `exdates` da série, senão a expansão devolveria a ocorrência antiga junto com a nova.
 */
export async function detachOccurrence(
  db: D1Database,
  userId: string,
  id: string,
  occurrence: number,
  fields: Partial<Omit<Task, "id" | "completed" | "exdates">>,
  newId: string,
): Promise<{ task: Task; series: Task } | null> {
  const master = await getTask(db, userId, id);
  if (!master || master.repeat === "Off") return null;

  const exdates = [...new Set([...(master.exdates ?? []), occurrence])];
  const detached: Task = {
    ...master,
    ...fields,
    id: newId,
    date: fields.date ?? occurrence,
    repeat: "Off",
    exdates: undefined,
    completed: [],
  };

  // batch = atômico: sem isso, um insert que falha deixaria a ocorrência apagada da série e sem
  // substituta — o dia simplesmente perderia a tarefa.
  await db.batch([
    db
      .prepare(`UPDATE tasks SET exdates=? WHERE user_id=? AND id=?`)
      .bind(JSON.stringify(exdates), userId, id),
    insertStatement(db, userId, detached),
  ]);
  // A série volta junto: o cliente precisa do `exdates` novo para reexpandir o mês sem a ocorrência.
  return { task: detached, series: { ...master, exdates } };
}

export async function updateTask(
  db: D1Database,
  userId: string,
  id: string,
  patch: Partial<Omit<Task, "id" | "completed" | "exdates">>,
): Promise<Task | null> {
  const cur = await getTask(db, userId, id);
  if (!cur) return null;
  const next: Task = { ...cur, ...patch, id, completed: cur.completed };
  const { kind, days } = repeatToCols(next.repeat);
  await db
    .prepare(
      `UPDATE tasks SET title=?,date=?,alert=?,duration=?,priority=?,repeat_kind=?,repeat_days=?,tags=?,links=? WHERE user_id=? AND id=?`,
    )
    .bind(
      next.title,
      next.date,
      next.alert ?? null,
      next.duration,
      next.priority,
      kind,
      days,
      next.tags ? JSON.stringify(next.tags) : null,
      next.links ? JSON.stringify(next.links) : null,
      userId,
      id,
    )
    .run();
  return next;
}
