import type { Task, Repeat } from "@dailify/shared";
import { startOfMonthMs, endOfMonthMs, stampUpdatedAt, taskHash } from "@dailify/shared";

/** Linha crua de `tasks`. Exportada para `db/push.ts`, que faz o próprio SELECT com um campo extra. */
export interface Row {
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
  const task = {
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
    updatedAt: r.updated_at,
  };
  // O hash não é coluna: dado derivado guardado é dado que sai de sincronia com a linha.
  return { ...task, hash: taskHash(task) };
}

function insertStatement(db: D1Database, userId: string, task: Task): D1PreparedStatement {
  const { kind, days } = repeatToCols(task.repeat);
  // Upsert, não INSERT: a fila offline reenvia a mesma criação quando a rede volta no meio do
  // caminho, e um id repetido não pode virar 500. O WHERE impede duas coisas: pisar na linha de
  // OUTRO usuário (a PK é global) e deixar uma escrita velha sobrescrever uma nova (LWW).
  return db
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
      stampUpdatedAt(task.updatedAt),
    );
}

/** `null` = o id existe e é de OUTRA conta: o upsert não tocou na linha e nada foi criado. */
export async function insertTask(db: D1Database, userId: string, task: Task): Promise<Task | null> {
  await insertStatement(db, userId, task).run();
  // Lê de volta: numa reentrada da fila o upsert pode ter recusado a escrita por ser mais velha
  // que a linha, e quem chamou precisa do que ficou GRAVADO, não do que tentou gravar.
  return getTask(db, userId, task.id);
}

export async function getMonthTasks(
  db: D1Database,
  userId: string,
  month: Date,
  timeZone?: string,
): Promise<Task[]> {
  const { results } = await db
    .prepare(`SELECT * FROM tasks WHERE user_id=? AND date>=? AND date<=?`)
    .bind(userId, startOfMonthMs(month, timeZone), endOfMonthMs(month, timeZone))
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

function exdatesWith(master: Task, occurrence: number): number[] {
  return [...new Set([...(master.exdates ?? []), occurrence])];
}

function setExdatesStatement(
  db: D1Database,
  userId: string,
  id: string,
  exdates: number[],
): D1PreparedStatement {
  return db
    .prepare(`UPDATE tasks SET exdates=? WHERE user_id=? AND id=?`)
    .bind(JSON.stringify(exdates), userId, id);
}

/**
 * "Excluir só esta ocorrência": nada é apagado de fato — a data entra no `exdates` e a expansão
 * para de gerar aquele dia. A série volta pro cliente reexpandir o mês.
 */
export async function excludeOccurrence(
  db: D1Database,
  userId: string,
  id: string,
  occurrence: number,
): Promise<Task | null> {
  const master = await getTask(db, userId, id);
  if (!master || master.repeat === "Off") return null;

  const exdates = exdatesWith(master, occurrence);
  await setExdatesStatement(db, userId, id, exdates).run();
  return { ...master, exdates };
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

  const exdates = exdatesWith(master, occurrence);
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
    setExdatesStatement(db, userId, id, exdates),
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
