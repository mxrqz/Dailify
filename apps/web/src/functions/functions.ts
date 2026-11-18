import type { Task } from "@dailify/shared";
import { addMonths, eachDayOfInterval, endOfMonth, isSameMonth, startOfMonth } from "date-fns";
import type { TaskCardData } from "@/components/task-card";
import { expandRecurringTask, seriesOf, zonedParts } from "@dailify/shared";

import { repeatLabel } from "@/functions/repeat-label";
import { appTimeZone, zoned, zonedAt } from "@/functions/zone";

export const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** `fill("{n} criadas", { n: 2 })`: copy placeholders; a missing key becomes "". */
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Zero-padded "HH:MM" in the app zone. */
export function getTime(time: number, format: "HH:MM"): string {
  const date = zoned(time);
  return format.replace("HH", pad2(date.getHours())).replace("MM", pad2(date.getMinutes()));
}

/** Concluída no dia do calendário de `selectedDay`: faixa numérica, sem formatar cada `completed`. */
export function getCompletionDate(task: Task, selectedDay: Date) {
  if (!Array.isArray(task.completed)) return;
  const [y, m, d] = [selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate()];
  const from = +zonedAt(y, m, d);
  const to = +zonedAt(y, m, d + 1);
  return task.completed.some((completedAt) => completedAt >= from && completedAt < to);
}

const dayKey = (ms: number, zone: string) => {
  const p = zonedParts(ms, zone);
  return `${p.year}-${p.month}-${p.day}`;
};
const NO_TASKS: readonly Task[] = [];
// O array de tarefas é imutável (todo setTasks troca a referência), então o índice vale enquanto ele viver.
const dayIndex = new WeakMap<Task[], { zone: string; byDay: Map<string, Task[]> }>();

/**
 * As tarefas do dia (no fuso do app). Chamado dias × renders: um índice por array troca o
 * `isSameDay` por tarefa por uma consulta. Devolve arrays compartilhados — não mutar.
 */
export function getTasksForDay(tasks: Task[], day: Date): readonly Task[] {
  const zone = appTimeZone();
  let index = dayIndex.get(tasks);
  if (index?.zone !== zone) {
    const byDay = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = dayKey(task.date, zone);
      const bucket = byDay.get(key);
      if (bucket) bucket.push(task);
      else byDay.set(key, [task]);
    }
    index = { zone, byDay };
    dayIndex.set(tasks, index);
  }
  return index.byDay.get(dayKey(+day, zone)) ?? NO_TASKS;
}

/**
 * Troca a tarefa e reconstrói as instâncias recorrentes do mês visível. O servidor só expande a
 * recorrência no GET, e as instâncias dividem o id da original — trocar só a entrada com o id
 * trocaria só a primeira. Sem isto, virar "não repetir" em "diária" (ou renomear uma recorrente) só aparecia no
 * próximo carregamento.
 */
export function upsertTaskWithRecurrence(tasks: Task[], task: Task, months: Date[]): Task[] {
  // An on-screen instance would re-anchor the series on itself and drop the earlier occurrences.
  const series = seriesOf(task);
  const others = tasks.filter((t) => t.id !== series.id);
  return [
    ...others,
    series,
    ...months.flatMap((month) => expandRecurringTask(series, month, appTimeZone())),
  ];
}

/** Mês de hoje e o seguinte: a lista contínua não pode esperar a rolagem chegar no fim. */
export function initialMonths(today: Date): Date[] {
  return [startOfMonth(today), startOfMonth(addMonths(today, 1))];
}

/** Dias de `start` a `end` que entram na lista: com tarefa, `extra` e, se pedido, o próprio início. */
export function listDays({
  start,
  end,
  tasks,
  extra = [],
  keepStart = false,
}: {
  start: Date;
  end: Date;
  tasks: Task[];
  extra?: Date[];
  keepStart?: boolean;
}): Date[] {
  // Uma passada nas tarefas, não uma por dia: com meses carregados o filtro virava O(dias × tarefas).
  const zone = appTimeZone();
  const keep = new Set(
    [...tasks.map((t) => t.date), ...extra.map(Number)].map((ms) => dayKey(ms, zone)),
  );
  return eachDayOfInterval({ start, end }).filter(
    (day, i) => (keepStart && i === 0) || keep.has(dayKey(+day, zone)),
  );
}

/** Primeiro mês sem carga a partir do de `start`: a lista termina logo antes dele. */
export function nextMonthToLoad(loaded: Date[], start: Date): Date {
  let month = startOfMonth(start);
  while (loaded.some((m) => isSameMonth(m, month))) month = addMonths(month, 1);
  return month;
}

/** Início de cada mês de `from` a `to`, inclusive. */
export function monthsBetween(from: Date, to: Date): Date[] {
  const months: Date[] = [];
  for (let m = startOfMonth(from); m <= to; m = addMonths(m, 1)) months.push(m);
  return months;
}

/** Troca as tarefas de `month` pelas que o servidor devolveu; os outros meses ficam como estão. */
export function mergeMonth(tasks: Task[], month: Date, fetched: Task[]): Task[] {
  const from = +startOfMonth(month);
  const to = +endOfMonth(month);
  return [...tasks.filter((t) => t.date < from || t.date > to), ...fetched];
}

export function isTaskModified(task: Task, updated: Task): boolean {
  if (task.title !== updated.title) return true;
  if (task.duration !== updated.duration) return true;
  if (task.priority !== updated.priority) return true;
  if (JSON.stringify(task.tags) !== JSON.stringify(updated.tags)) return true;
  if (JSON.stringify(task.links) !== JSON.stringify(updated.links)) return true;

  if (task.date !== updated.date) return true;
  // alert falls back to date on both sides so a task without an alert isn't flagged as changed
  if ((task.alert ?? task.date) !== (updated.alert ?? updated.date)) return true;

  const isRepeatChanged = JSON.stringify(task.repeat) !== JSON.stringify(updated.repeat);
  if (isRepeatChanged) return true;
  if ((task.repeatEvery ?? 1) !== (updated.repeatEvery ?? 1)) return true;

  return false;
}

export interface TimeGroup {
  /** "HH:MM" zero-padded, o mesmo formato de `getTime(date, "HH:MM")`. */
  time: string;
  tasks: Task[];
}

/** Agrupa as tarefas do dia pela hora cheia ("16:00" junta 16:00 e 16:45), em ordem. Não muta. */
export function groupTasksByHour(tasks: ReadonlyArray<Task>): TimeGroup[] {
  // One day's tasks: epoch order is clock order.
  const sorted = [...tasks].sort((a, b) => a.date - b.date);
  const byHour = new Map<string, Task[]>();
  for (const task of sorted) {
    const hour = `${getTime(task.date, "HH:MM").slice(0, 2)}:00`;
    const bucket = byHour.get(hour);
    if (bucket) bucket.push(task);
    else byHour.set(hour, [task]);
  }
  return [...byHour.entries()].map(([time, group]) => ({ time, tasks: group }));
}

/** "HH:MM" → minutos desde a meia-noite; `getTime` já garante o zero-padding. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Converte a tarefa do domínio (epoch-ms, priority numérico, completed[]) no formato de strings que
 * o `TaskCard` consome. `day` é o dia em que o cartão está sendo renderizado — é ele que decide se a
 * tarefa conta como concluída (uma recorrente é concluída por ocorrência, não de uma vez).
 */
export function taskToCardData(
  task: Task,
  day: Date,
): TaskCardData & { completed: boolean; priority: number; links: string[]; repeat: string } {
  return {
    time: getTime(task.date, "HH:MM"),
    title: task.title,
    duration: task.duration,
    tags: task.tags ?? [],
    priority: task.priority,
    completed: getCompletionDate(task, day) === true,
    links: task.links ?? [],
    repeat: repeatLabel(task.repeat, task.repeatEvery),
  };
}

/** "HH:MM" como a config pede: igual em 24h; em 12h "04:45 PM", com o zero à frente (largura fixa). */
export function formatClock(time: string, hour12: boolean): string {
  if (!hour12) return time;
  const [hours, minutes] = time.split(":");
  const h = Number(hours);
  return `${String(h % 12 || 12).padStart(2, "0")}:${minutes} ${h < 12 ? "AM" : "PM"}`;
}
