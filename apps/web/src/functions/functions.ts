import { TaskProps } from "@/types/types";
import { format, isSameDay } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import type { TaskCardData } from "@/components/task-card";

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

export function getNextTask(currentMonthTasks: TaskProps[]) {
  const now = Date.now();
  const orderedTasks = [...currentMonthTasks].sort((a, b) => a.date - b.date);
  const nextTask = orderedTasks.find((task) => task.date > now);

  return nextTask;
}

export function isTaskModified(task: TaskProps, updated: TaskProps): boolean {
  if (task.title !== updated.title) return true;
  if (task.description !== updated.description) return true;
  if (task.duration !== updated.duration) return true;
  if (task.priority !== updated.priority) return true;
  if (JSON.stringify(task.tags) !== JSON.stringify(updated.tags)) return true;

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

/**
 * Agrupa as tarefas do dia por horário e ordena os grupos cronologicamente. Extraído de
 * `daily-tasks.tsx` e `calendar-view.tsx`, que tinham este mesmo reduce+sort copiado.
 * Não muta a entrada.
 */
export function groupTasksByTime(tasks: ReadonlyArray<TaskProps>): TimeGroup[] {
  const byTime = new Map<string, TaskProps[]>();
  for (const task of tasks) {
    const time = getTime(task.date, "HH:MM");
    const bucket = byTime.get(time);
    if (bucket) bucket.push(task);
    else byTime.set(time, [task]);
  }
  return [...byTime.entries()]
    .map(([time, group]) => ({ time, tasks: group }))
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
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
): TaskCardData & { completed: boolean; priority: number } {
  return {
    time: getTime(task.date, "HH:MM"),
    title: task.title,
    duration: task.duration,
    tags: task.tags ?? [],
    priority: task.priority,
    completed: getCompletionDate(task, day) === true,
  };
}

/**
 * Índice do grupo ANTES do qual a linha do "agora" é inserida; `groups.length` = depois de todos.
 * Um grupo que começa exatamente agora fica à frente da linha (a tarefa está começando, não passou).
 * Os extremos são deliberados: a linha aparece no topo antes do primeiro compromisso e no rodapé
 * depois do último, que são justamente os dois momentos do dia em que ela mais informa.
 */
export function nowLineIndex(
  groups: ReadonlyArray<Pick<TimeGroup, "time">>,
  now: Date,
): number {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const index = groups.findIndex((group) => timeToMinutes(group.time) >= nowMinutes);
  return index === -1 ? groups.length : index;
}
