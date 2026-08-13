import { addDays, format, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { dayAnchorId } from "@/components/dashboard/day-section";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTasksForDay } from "@/functions/functions";
import { cn } from "@/lib/utils";

const DAYS_AHEAD = 7;
const MAX_DOTS = 3;

/**
 * Os próximos sete dias em uma linha, com um ponto nos que têm tarefa. Substitui o mini-calendário
 * que ocupava a dobra: 42 células pra mostrar o que cabe em sete.
 *
 * Clicar rola até o dia na lista; o mês inteiro continua a um clique, no popover à direita.
 */
export function WeekStrip(): JSX.Element {
  const { tasks } = useDailify();
  const today = startOfDay(new Date());
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));

  const goTo = (day: Date) => {
    document
      .getElementById(dayAnchorId(day))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-surface-line bg-surface-card p-2">
      {days.map((day) => {
        const current = isToday(day);
        const dots = Math.min(tasks ? getTasksForDay(tasks, day).length : 0, MAX_DOTS);

        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => goTo(day)}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
              current ? "bg-surface-hover" : "hover:bg-surface-hover",
            )}
          >
            <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
              {format(day, "EEEEEE", { locale: ptBR })}
            </span>

            <span
              className={cn(
                "text-sm font-medium",
                current ? "text-accent-primary" : "text-foreground",
              )}
            >
              {format(day, "d")}
            </span>

            {/* Altura reservada mesmo sem tarefa: senão os dias sobem e descem na faixa. */}
            <span className="flex h-1 items-center gap-0.5" aria-hidden="true">
              {Array.from({ length: dots }).map((_, index) => (
                <span key={index} className="size-1 rounded-full bg-accent-primary" />
              ))}
            </span>
          </button>
        );
      })}

      <Popover>
        <PopoverTrigger
          aria-label={copy.day.openCalendar}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          <CalendarIcon className="size-4" />
        </PopoverTrigger>

        <PopoverContent align="end" className="w-auto border-surface-line bg-surface-card p-3">
          <MiniCalendar />
        </PopoverContent>
      </Popover>
    </div>
  );
}
