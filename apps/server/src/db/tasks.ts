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
    id: r.id,
    title: r.title,
    date: r.date,
    alert: r.alert ?? undefined,
    duration: r.duration,
    priority: r.priority,
    repeat: colsToRepeat(r.repeat_kind, r.repeat_days),
    tags: r.tags ? JSON.parse(r.tags) : undefined,
    links: r.links ? JSON.parse(r.links) : undefined,
    completed: JSON.parse(r.completed),
  };
}

export async function insertTask(db: D1Database, userId: string, task: Task): Promise<Task> {
  const { kind, days } = repeatToCols(task.repeat);
  await db
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
    )
    .run();
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
 * Desfaz a conclusão de UMA ocorrência. O intervalo vem do cliente porque o dia é local dele: o
 * Worker roda em UTC e não tem como saber onde o dia do usuário começa.
 */
export async function removeCompletions(
  db: D1Database,
  userId: string,
  id: string,
  from: number,
  to: number,
): Promise<Task | null> {
  const task = await getTask(db, userId, id);
  if (!task) return null;
  const completed = task.completed.filter((at) => at < from || at > to);
  await db
    .prepare(`UPDATE tasks SET completed=? WHERE user_id=? AND id=?`)
    .bind(JSON.stringify(completed), userId, id)
    .run();
  return { ...task, completed };
}

export async function updateTask(
  db: D1Database,
  userId: string,
  id: string,
  patch: Partial<Omit<Task, "id" | "completed">>,
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
