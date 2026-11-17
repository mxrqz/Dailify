import { periodStart, type Task, type WeekStart } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { appTimeZone } from "@/functions/zone";
import { cn } from "@/lib/utils";

export type PeriodKind = "Daily" | "Weekly" | "Monthly" | "Yearly";

export const periodKind = (repeat: Exclude<Task["repeat"], "Off">): PeriodKind =>
  typeof repeat === "object" ? "Weekly" : repeat;

/** Inícios dos períodos, do mais antigo ao atual, desde o que contém `origin` (máx. `limit`). */
export function periodStarts(
  repeat: Exclude<Task["repeat"], "Off">,
  origin: number,
  now: number,
  weekStart: WeekStart,
  timeZone: string,
  limit: number,
  /** `repeatEvery` e a `date` da tarefa, que dá a fase dos períodos de N unidades. */
  every = 1,
  anchor = origin,
): number[] {
  const start = (at: number) => periodStart(repeat, at, weekStart, timeZone, every, anchor);
  const starts = [start(now)];
  while (starts.length < limit && starts[0] > origin) starts.unshift(start(starts[0] - 1));
  return starts;
}

/**
 * Um quadradinho por período desde a criação: cheio se houve conclusão nele. Não há `createdAt` no
 * modelo: a origem é a data da tarefa ou a conclusão mais antiga.
 */
export function CheckHistory({
  task,
  weekStart,
  periods = 7,
}: {
  task: Task;
  weekStart: WeekStart;
  periods?: number;
}): JSX.Element | null {
  if (task.repeat === "Off") return null;

  const now = Date.now();
  const origin = Math.min(task.date, ...task.completed);
  const starts = periodStarts(
    task.repeat,
    origin,
    now,
    weekStart,
    appTimeZone(),
    periods,
    task.repeatEvery,
    task.date,
  );
  const filled = starts.map((start, i) => {
    const end = starts[i + 1] ?? Infinity;
    return task.completed.some((c) => c >= start && c < end);
  });
  const label = copy.undated.history
    .replace("{done}", String(filled.filter(Boolean).length))
    .replace("{total}", String(starts.length))
    .replace("{unit}", copy.undated[`unit${periodKind(task.repeat)}`]);

  return (
    <span role="img" aria-label={label} className="ml-1 flex items-center gap-0.75">
      {/* ponytail: quadrado reto; o spec pede raio de 2px, que não tem token (--radius-2xs). */}
      {filled.map((full, i) => (
        <i
          key={starts[i]}
          data-filled={full}
          className={cn("size-1.5", full ? "bg-ink-secondary" : "bg-fill-pressed")}
        />
      ))}
    </span>
  );
}
