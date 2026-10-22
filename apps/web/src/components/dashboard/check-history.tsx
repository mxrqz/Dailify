import { periodStart, type Task, type WeekStart } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { browserTimeZone } from "@/functions/undated";
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
): number[] {
  const starts = [periodStart(repeat, now, weekStart, timeZone)];
  while (starts.length < limit && starts[0] > origin)
    starts.unshift(periodStart(repeat, starts[0] - 1, weekStart, timeZone));
  return starts;
}

/**
 * Uma bolinha por período desde a criação: cheia (verde) se houve conclusão nele, a atual com anel.
 * Não há `createdAt` no modelo: a origem é a data da tarefa ou a conclusão mais antiga.
 */
export function CheckHistory({
  task,
  weekStart,
  periods = 12,
}: {
  task: Task;
  weekStart: WeekStart;
  periods?: number;
}): JSX.Element | null {
  if (task.repeat === "Off") return null;

  const now = Date.now();
  const origin = Math.min(task.date, ...task.completed);
  const starts = periodStarts(task.repeat, origin, now, weekStart, browserTimeZone(), periods);
  const filled = starts.map((start, i) => {
    const end = starts[i + 1] ?? Infinity;
    return task.completed.some((c) => c >= start && c < end);
  });
  const label = copy.undated.history
    .replace("{done}", String(filled.filter(Boolean).length))
    .replace("{total}", String(starts.length))
    .replace("{unit}", copy.undated[`unit${periodKind(task.repeat)}`]);

  return (
    <span role="img" aria-label={label} className="flex items-center gap-1">
      {filled.map((full, i) => (
        <i
          key={starts[i]}
          data-filled={full}
          className={cn(
            "size-1.5 rounded-full",
            full ? "bg-success" : "bg-surface-line",
            i === starts.length - 1 &&
              "ring-1 ring-highlight ring-offset-1 ring-offset-surface-card",
          )}
        />
      ))}
    </span>
  );
}
