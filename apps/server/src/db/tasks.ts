import type { Task, Repeat } from "@dailify/shared";
import {
  endOfMonthMs,
  expandRecurringTask,
  stampUpdatedAt,
  startOfMonthMs,
  taskHash,
} from "@dailify/shared";

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  date: number;
  alert: number | null;
  duration: string;
  priority: number;
  repeat_kind: string;
  repeat_days: string | null;
  repeat_every: number | null;
  repeat_until: number | null;
  tags: string | null;
  links: string | null;
  completed: string;
  updated_at: number;
  exdates: string | null;
  undated: number;
}

/** What an edit may change: id, completions and `exdates` each have their own write path. */
export type TaskFields = Partial<Omit<Task, "id" | "completed" | "exdates">>;

// A corrupt JSON column counts as `[]` in SQL too, as `numberArray` does on read.
const jsonOrEmpty = (col: string) => `CASE WHEN json_valid(${col}) THEN ${col} ELSE '[]' END`;
const COMPLETED = jsonOrEmpty("completed");

function repeatToCols(repeat: Repeat): { kind: string; days: string | null } {
  if (typeof repeat === "string") return { kind: repeat, days: null };
  return { kind: "Weekly", days: JSON.stringify(repeat.Weekly) };
}

/** Sem série não há intervalo: um `repeatEvery` órfão voltaria se a tarefa ganhasse série de novo. */
const everyCol = (task: Task): number | null =>
  task.repeat !== "Off" && task.repeatEvery && task.repeatEvery > 1 ? task.repeatEvery : null;
const untilCol = (task: Task): number | null =>
  task.repeat !== "Off" && task.repeatUntil !== undefined ? task.repeatUntil : null;

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

export function rowToTask(r: TaskRow): Task {
  const task = {
    id: r.id,
    title: r.title,
    date: r.date,
    alert: r.alert ?? undefined,
    duration: r.duration,
    priority: r.priority,
    repeat: colsToRepeat(r.repeat_kind, r.repeat_days),
    repeatEvery: r.repeat_every && r.repeat_every > 1 ? r.repeat_every : undefined,
    repeatUntil: r.repeat_until ?? undefined,
    tags: stringArray(r.tags),
    links: stringArray(r.links),
    completed: numberArray(r.completed),
    exdates: r.exdates ? numberArray(r.exdates) : undefined,
    updatedAt: r.updated_at,
    undated: r.undated === 1 ? true : undefined,
  };
  // O hash não é coluna: dado derivado guardado é dado que sai de sincronia com a linha.
  return { ...task, hash: taskHash(task) };
}

export function insertStatement(db: D1Database, userId: string, task: Task): D1PreparedStatement {
  const { kind, days } = repeatToCols(task.repeat);
  // Upsert, não INSERT: a fila offline reenvia a mesma criação quando a rede volta no meio do
  // caminho, e um id repetido não pode virar 500. O WHERE impede duas coisas: pisar na linha de
  // OUTRO usuário (a PK é global) e deixar uma escrita velha sobrescrever uma nova (LWW).
  return db
    .prepare(
      `INSERT INTO tasks (id,user_id,title,date,alert,duration,priority,repeat_kind,repeat_days,repeat_every,repeat_until,tags,links,completed,updated_at,undated)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, date=excluded.date, alert=excluded.alert, duration=excluded.duration,
       priority=excluded.priority, repeat_kind=excluded.repeat_kind, repeat_days=excluded.repeat_days,
       repeat_every=excluded.repeat_every, repeat_until=excluded.repeat_until, tags=excluded.tags, links=excluded.links, completed=excluded.completed,
       updated_at=excluded.updated_at, undated=excluded.undated
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
      everyCol(task),
      untilCol(task),
      task.tags ? JSON.stringify(task.tags) : null,
      task.links ? JSON.stringify(task.links) : null,
      JSON.stringify(task.completed),
      stampUpdatedAt(task.updatedAt),
      task.undated ? 1 : 0,
    );
}

/** `null` = o id existe e é de OUTRA conta: o upsert não tocou na linha e nada foi criado. */
export async function insertTask(db: D1Database, userId: string, task: Task): Promise<Task | null> {
  // Read back in the same batch: a replayed queue write may be refused as older than the row, and
  // the caller needs what is STORED. A SELECT, not RETURNING: a refused upsert returns no row.
  const [, read] = await db.batch<TaskRow>([
    insertStatement(db, userId, task),
    db.prepare(`SELECT * FROM tasks WHERE user_id=? AND id=?`).bind(userId, task.id),
  ]);
  const r = read.results[0];
  return r ? rowToTask(r) : null;
}

export async function getMonthTasks(
  db: D1Database,
  userId: string,
  month: Date,
  timeZone?: string,
): Promise<Task[]> {
  const { results } = await db
    .prepare(`SELECT * FROM tasks WHERE user_id=? AND undated=0 AND date>=? AND date<=?`)
    .bind(userId, startOfMonthMs(month, timeZone), endOfMonthMs(month, timeZone))
    .all<TaskRow>();
  return results.map(rowToTask);
}

export async function getRecurringTasks(db: D1Database, userId: string): Promise<Task[]> {
  const { results } = await db
    .prepare(`SELECT * FROM tasks WHERE user_id=? AND undated=0 AND repeat_kind!='Off'`)
    .bind(userId)
    .all<TaskRow>();
  return results.map(rowToTask);
}

/** The month as the agenda shows it: dated tasks plus expanded series, deduped by `id-date`. */
export async function readMonth(
  db: D1Database,
  userId: string,
  month: Date,
  timeZone?: string,
): Promise<Task[]> {
  const [inRange, recurring] = await Promise.all([
    getMonthTasks(db, userId, month, timeZone),
    getRecurringTasks(db, userId),
  ]);
  const expanded = recurring.flatMap((t) => expandRecurringTask(t, month, timeZone));
  const byKey = new Map<string, Task>();
  for (const t of [...inRange, ...expanded]) byKey.set(`${t.id}-${t.date}`, t);
  return [...byKey.values()];
}

export async function getUndatedTasks(db: D1Database, userId: string): Promise<Task[]> {
  const { results } = await db
    .prepare(`SELECT * FROM tasks WHERE user_id=? AND undated=1`)
    .bind(userId)
    .all<TaskRow>();
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

export async function getTask(db: D1Database, userId: string, id: string): Promise<Task | null> {
  const r = await db
    .prepare(`SELECT * FROM tasks WHERE user_id=? AND id=?`)
    .bind(userId, id)
    .first<TaskRow>();
  return r ? rowToTask(r) : null;
}

export async function deleteTask(db: D1Database, userId: string, id: string): Promise<void> {
  await db.prepare(`DELETE FROM tasks WHERE user_id=? AND id=?`).bind(userId, id).run();
}

/** Every app table keyed by `user_id`; `account-delete.test.ts` fails when the schema adds one. */
export const USER_TABLES = [
  "tasks",
  "push_subscriptions",
  "user_settings",
  "usage",
  "integration_connections",
  "integration_links",
  "oauth_states",
  "mew_actions",
] as const;

/** Tudo que o usuário tem no D1 — chamado pelo `afterDelete` da conta (auth-options.ts). */
export async function deleteUserData(db: D1Database, userId: string): Promise<void> {
  await db.batch(
    USER_TABLES.map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id=?`).bind(userId)),
  );
}

export async function appendCompletion(
  db: D1Database,
  userId: string,
  id: string,
  at: number,
): Promise<Task | null> {
  // Merged in SQL so two crossing completions keep both. MAX: a queued `at` can be in the past, and
  // lowering the stamp would let an older queued edit beat a newer one. An `at` already present is
  // the queue replaying the same completion: no row changes and the stored task comes back.
  const r = await db
    .prepare(
      `UPDATE tasks SET completed=json_insert(${COMPLETED},'$[#]',?1), updated_at=MAX(updated_at,?2)
       WHERE user_id=?3 AND id=?4
         AND NOT EXISTS (SELECT 1 FROM json_each(${COMPLETED}) WHERE value=?1)
       RETURNING *`,
    )
    .bind(at, stampUpdatedAt(at), userId, id)
    .first<TaskRow>();
  return r ? rowToTask(r) : getTask(db, userId, id);
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
  const r = await db
    .prepare(
      `UPDATE tasks SET updated_at=?, completed=(
         SELECT json_group_array(value) FROM json_each(${COMPLETED}) WHERE value<? OR value>?
       ) WHERE user_id=? AND id=? RETURNING *`,
    )
    .bind(stampUpdatedAt(undefined), from, to, userId, id)
    .first<TaskRow>();
  return r ? rowToTask(r) : null;
}

// Merged in SQL: a read-merge-write in JS drops a date written meanwhile (a PATCH ?occurrence=
// racing the Calendar sync) and that occurrence comes back.
export function addExdatesStatement(
  db: D1Database,
  userId: string,
  id: string,
  dates: number[],
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE tasks SET exdates=(SELECT json_group_array(value) FROM (
         SELECT value FROM json_each(${jsonOrEmpty("tasks.exdates")})
         UNION SELECT value FROM json_each(?)
       )) WHERE user_id=? AND id=? RETURNING *`,
    )
    .bind(JSON.stringify(dates), userId, id);
}

/** Replaces the whole list: only for a caller holding the complete one (the import batch). */
export function setExdatesStatement(
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

  const r = await addExdatesStatement(db, userId, id, [occurrence]).first<TaskRow>();
  return r ? rowToTask(r) : null;
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
  fields: TaskFields,
  newId: string,
): Promise<{ task: Task; series: Task } | null> {
  const master = await getTask(db, userId, id);
  if (!master || master.repeat === "Off") return null;

  const detached: Task = {
    ...master,
    ...fields,
    id: newId,
    date: fields.date ?? occurrence,
    repeat: "Off",
    repeatEvery: undefined,
    repeatUntil: undefined,
    exdates: undefined,
    completed: [],
  };

  // batch = atômico: sem isso, um insert que falha deixaria a ocorrência apagada da série e sem
  // substituta — o dia simplesmente perderia a tarefa.
  const [series] = await db.batch<TaskRow>([
    addExdatesStatement(db, userId, id, [occurrence]),
    insertStatement(db, userId, detached),
  ]);
  // A série volta junto: o cliente precisa do `exdates` novo para reexpandir o mês sem a ocorrência.
  const r = series.results[0];
  return r ? { task: detached, series: rowToTask(r) } : null;
}

export async function updateTask(
  db: D1Database,
  userId: string,
  id: string,
  patch: TaskFields,
): Promise<Task | null> {
  const cur = await getTask(db, userId, id);
  if (!cur) return null;

  // LWW: uma edição feita ANTES da que já está gravada não sobrescreve nada — é a fila offline
  // subindo tarde. Quem chamou recebe a versão do servidor e reconcilia com ela.
  const updatedAt = stampUpdatedAt(patch.updatedAt);
  if (updatedAt < (cur.updatedAt ?? 0)) return cur;

  const merged: Task = {
    ...cur,
    ...patch,
    id,
    completed: cur.completed,
    updatedAt,
  };
  const next: Task = {
    ...merged,
    repeatEvery: everyCol(merged) ?? undefined,
    repeatUntil: untilCol(merged) ?? undefined,
  };
  // Mesmo conteúdo: não gasta escrita nem carimbo novo.
  if (taskHash(next) === taskHash(cur)) return cur;
  const { kind, days } = repeatToCols(next.repeat);
  const r = await db
    .prepare(
      // Lembrete novo/mudado precisa poder disparar: o envio avulso exige `alert_sent IS NULL`.
      // LWW again in the WHERE: another write may land between the getTask above and this UPDATE.
      `UPDATE tasks SET title=?,date=?,alert=?,duration=?,priority=?,repeat_kind=?,repeat_days=?,repeat_every=?,repeat_until=?,tags=?,links=?,updated_at=?,undated=?,alert_sent=CASE WHEN ? THEN NULL ELSE alert_sent END WHERE user_id=? AND id=? AND updated_at<=? RETURNING *`,
    )
    .bind(
      next.title,
      next.date,
      next.alert ?? null,
      next.duration,
      next.priority,
      kind,
      days,
      everyCol(next),
      untilCol(next),
      next.tags ? JSON.stringify(next.tags) : null,
      next.links ? JSON.stringify(next.links) : null,
      updatedAt,
      next.undated ? 1 : 0,
      next.alert !== cur.alert ? 1 : 0,
      userId,
      id,
      updatedAt,
    )
    .first<TaskRow>();
  return r ? rowToTask(r) : getTask(db, userId, id);
}
