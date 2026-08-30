import type { Task, Repeat } from "@dailify/shared";
import { startOfMonthMs, endOfMonthMs, stampUpdatedAt, taskHash } from "@dailify/shared";

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
  updated_at: number;
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
  const task = {
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
    updatedAt: r.updated_at,
  };
  // O hash não é coluna: dado derivado guardado é dado que sai de sincronia com a linha.
  return { ...task, hash: taskHash(task) };
}

export async function insertTask(db: D1Database, userId: string, task: Task): Promise<Task> {
  const { kind, days } = repeatToCols(task.repeat);
  const updatedAt = stampUpdatedAt(task.updatedAt);

  // Upsert, não INSERT: a fila offline reenvia a mesma criação quando a rede volta no meio do
  // caminho, e um id que já existe não pode virar 500 (bd Dailify-7wg). O WHERE é o que impede
  // duas coisas: pisar na linha de OUTRO usuário (a PK é global) e deixar uma escrita velha
  // sobrescrever uma nova (LWW).
  await db
    .prepare(
      `INSERT INTO tasks (id,user_id,title,date,alert,duration,priority,repeat_kind,repeat_days,tags,links,completed,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, date=excluded.date, alert=excluded.alert, duration=excluded.duration,
       priority=excluded.priority, repeat_kind=excluded.repeat_kind, repeat_days=excluded.repeat_days,
       tags=excluded.tags, links=excluded.links, completed=excluded.completed,
       updated_at=excluded.updated_at
     WHERE tasks.user_id=excluded.user_id AND tasks.updated_at<=excluded.updated_at`,
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
      updatedAt,
    )
    .run();

  // Lê de volta: numa colisão o WHERE pode ter recusado a escrita, e quem chamou precisa do que
  // ficou gravado, não do que tentou gravar.
  const stored = await getTask(db, userId, task.id);
  return stored ?? { ...task, updatedAt, hash: taskHash(task) };
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
  // Já concluída neste instante: a fila reenviou a mesma conclusão, não é uma segunda.
  if (task.completed.includes(at)) return task;

  const completed = [...task.completed, at];
  const updatedAt = stampUpdatedAt(at);
  await db
    .prepare(`UPDATE tasks SET completed=?, updated_at=? WHERE user_id=? AND id=?`)
    .bind(JSON.stringify(completed), updatedAt, userId, id)
    .run();
  return { ...task, completed, updatedAt, hash: taskHash({ ...task, completed }) };
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
  const updatedAt = stampUpdatedAt(undefined);
  await db
    .prepare(`UPDATE tasks SET completed=?, updated_at=? WHERE user_id=? AND id=?`)
    .bind(JSON.stringify(completed), updatedAt, userId, id)
    .run();
  return { ...task, completed, updatedAt, hash: taskHash({ ...task, completed }) };
}

export async function updateTask(
  db: D1Database,
  userId: string,
  id: string,
  patch: Partial<Omit<Task, "id" | "completed">>,
): Promise<Task | null> {
  const cur = await getTask(db, userId, id);
  if (!cur) return null;

  // LWW: uma edição feita ANTES da que já está gravada não sobrescreve nada — é a fila offline
  // subindo tarde. Quem chamou recebe a versão do servidor e reconcilia com ela.
  const updatedAt = stampUpdatedAt(patch.updatedAt);
  if (updatedAt < (cur.updatedAt ?? 0)) return cur;

  const next: Task = { ...cur, ...patch, id, completed: cur.completed, updatedAt };
  // Mesmo conteúdo: não gasta escrita nem carimbo novo.
  if (taskHash(next) === taskHash(cur)) return cur;
  const { kind, days } = repeatToCols(next.repeat);
  await db
    .prepare(
      `UPDATE tasks SET title=?,date=?,alert=?,duration=?,priority=?,repeat_kind=?,repeat_days=?,tags=?,links=?,updated_at=? WHERE user_id=? AND id=?`,
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
      updatedAt,
      userId,
      id,
    )
    .run();
  return { ...next, hash: taskHash(next) };
}
