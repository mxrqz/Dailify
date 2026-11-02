import { TaskProps } from "@/types/types";
import {
  addMonths,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import type { TaskCardData } from "@/components/task-card";
import { expandRecurringTask } from "@dailify/shared";

import { repeatLabel } from "@/functions/repeat-label";

export const returnFractedDate = (date: Date) => {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  return { day, month, year };
};

export function getTime(
  time: number,
  format: "{hours, minutes}",
): { hours: number; minutes: number };
export function getTime(time: number, format: "HH:MM"): string;
export function getTime(time: number, format: "{hours, minutes}" | "HH:MM") {
  const date = new Date(time);
  const hours = date.getHours();
  const minutes = date.getMinutes();

  if (format === "{hours, minutes}") return { hours, minutes };
  if (format === "HH:MM") {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  return "";
}

export const formatDateByLocale = (date: Date, locale: string) => {
  const dateLocale = locale.startsWith("pt") ? ptBR : enUS;
  return format(date, "PPPP", { locale: dateLocale });
};

export function getCompletionDate(task: TaskProps, selectedDay: Date) {
  if (!Array.isArray(task.completed)) return;
  const haveBeenCompletedToday = task.completed.some(
    (completedAt) => format(new Date(completedAt), "P") === format(selectedDay, "P"),
  )
    ? true
    : false;

  return haveBeenCompletedToday;
}

export function getTasksForDay(tasks: TaskProps[], day: Date): TaskProps[] {
  return tasks.filter((task) => isSameDay(new Date(task.date), day));
}

/** Append `task` to the list, or replace the existing entry with the same id. */
export function upsertTaskById(tasks: TaskProps[], task: TaskProps): TaskProps[] {
  const i = tasks.findIndex((t) => t.id === task.id);
  if (i === -1) return [...tasks, task];
  const next = [...tasks];
  next[i] = task;
  return next;
}

/**
 * Troca a tarefa e reconstrói as instâncias recorrentes do mês visível. O servidor só expande a
 * recorrência no GET, e as instâncias dividem o id da original — `upsertTaskById` trocaria só a
 * primeira. Sem isto, virar "não repetir" em "diária" (ou renomear uma recorrente) só aparecia no
 * próximo carregamento.
 */
export function upsertTaskWithRecurrence(
  tasks: TaskProps[],
  task: TaskProps,
  months: Date[],
): TaskProps[] {
  const others = tasks.filter((t) => t.id !== task.id);
  return [...others, task, ...months.flatMap((month) => expandRecurringTask(task, month))];
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
  tasks: TaskProps[];
  extra?: Date[];
  keepStart?: boolean;
}): Date[] {
  // Uma passada nas tarefas, não uma por dia: com meses carregados o filtro virava O(dias × tarefas).
  const keep = new Set(
    [...tasks.map((t) => t.date), ...extra].map((d) => new Date(d).toDateString()),
  );
  return eachDayOfInterval({ start, end }).filter(
    (day, i) => (keepStart && i === 0) || keep.has(day.toDateString()),
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
export function mergeMonth(tasks: TaskProps[], month: Date, fetched: TaskProps[]): TaskProps[] {
  return [...tasks.filter((t) => !isSameMonth(t.date, month)), ...fetched];
}

export function getNextTask(currentMonthTasks: TaskProps[]) {
  const now = Date.now();
  const orderedTasks = [...currentMonthTasks].sort((a, b) => a.date - b.date);
  const nextTask = orderedTasks.find((task) => task.date > now);

  return nextTask;
}

export function isTaskModified(task: TaskProps, updated: TaskProps): boolean {
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

  return false;
}

export function unixToDate(unix: number): Date {
  return new Date(unix * 1000);
}

export interface TimeGroup {
  /** "HH:MM" zero-padded, o mesmo formato de `getTime(date, "HH:MM")`. */
  time: string;
  tasks: TaskProps[];
}

/** Agrupa as tarefas do dia pela hora cheia ("16:00" junta 16:00 e 16:45), em ordem. Não muta. */
export function groupTasksByHour(tasks: ReadonlyArray<TaskProps>): TimeGroup[] {
  const sorted = [...tasks].sort(
    (a, b) => timeToMinutes(getTime(a.date, "HH:MM")) - timeToMinutes(getTime(b.date, "HH:MM")),
  );
  const byHour = new Map<string, TaskProps[]>();
  for (const task of sorted) {
    const hour = `${getTime(task.date, "HH:MM").slice(0, 2)}:00`;
    const bucket = byHour.get(hour);
    if (bucket) bucket.push(task);
    else byHour.set(hour, [task]);
  }
  return [...byHour.entries()].map(([time, group]) => ({ time, tasks: group }));
}

/** "HH:MM" → minutos desde a meia-noite. Interno; `getTime` já garante o zero-padding. */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Converte a tarefa do domínio (epoch-ms, priority numérico, completed[]) no formato de strings que
 * o `TaskCard` consome. `day` é o dia em que o cartão está sendo renderizado — é ele que decide se a
 * tarefa conta como concluída (uma recorrente é concluída por ocorrência, não de uma vez).
 */
export function taskToCardData(
  task: TaskProps,
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
    repeat: repeatLabel(task.repeat),
  };
}

/** "HH:MM" como a config pede: igual em 24h; em 12h "04:45 PM", com o zero à frente (largura fixa). */
export function formatClock(time: string, hour12: boolean): string {
  if (!hour12) return time;
  const [hours, minutes] = time.split(":");
  const h = Number(hours);
  return `${String(h % 12 || 12).padStart(2, "0")}:${minutes} ${h < 12 ? "AM" : "PM"}`;
}

/** Minutos daqui até o "HH:MM" de hoje. Negativo quando o horário já passou. */
export function minutesUntil(time: string, now: Date): number {
  return timeToMinutes(time) - (now.getHours() * 60 + now.getMinutes());
}

/** Índice do primeiro grupo que ainda não começou; -1 quando o dia inteiro já passou. */
export function nextGroupIndex(groups: ReadonlyArray<Pick<TimeGroup, "time">>, now: Date): number {
  return groups.findIndex((group) => minutesUntil(group.time, now) >= 0);
}
