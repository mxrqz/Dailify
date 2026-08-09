import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** Grid do mês — segunda-a-domingo, casando com o app. Decorativo (datas fake). */
const WEEKDAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"] as const;
const MONTH_DAYS: ReadonlyArray<number | null> = [
  null,
  null,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  null,
  null,
  null,
];
const TODAY = 14; // Qui, 14 Ago — mesmo dia do peek <DayAppWindow>
const TASK_DAYS: ReadonlySet<number> = new Set([3, 7, 8, 12, 17, 22, 27]);

/** "App window" da visão de mês — chrome + grid com dots de tarefa. `className` controla o tamanho. */
export function CalendarAppWindow({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-2xl border border-surface-line bg-surface-card shadow-panel",
        className ?? "h-152",
      )}
    >
      <div className="flex items-center justify-between border-b border-surface-line px-6 py-4">
        <span className="text-sm font-medium text-foreground">Agosto 2026</span>
        <div className="flex items-center gap-1 text-muted-foreground">
          <ChevronLeft className="size-4" aria-hidden="true" />
          <ChevronRight className="size-4" aria-hidden="true" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-6">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <span
              key={label}
              className="text-center font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1">
          {MONTH_DAYS.map((day, index) => (
            <div key={index} className="flex flex-col items-center justify-center gap-1">
              {day !== null && (
                <>
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full font-mono text-xs",
                      day === TODAY
                        ? "bg-accent-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    {day}
                  </span>
                  <span
                    className={cn(
                      "size-1 rounded-full",
                      TASK_DAYS.has(day) ? "bg-accent-primary" : "bg-transparent",
                    )}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
