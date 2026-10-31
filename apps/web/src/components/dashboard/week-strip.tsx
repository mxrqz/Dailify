import { useEffect, useRef, type RefObject } from "react";
import { addDays, format, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { motion } from "motion/react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTasksForDay } from "@/functions/functions";
import { spring } from "@/consts/motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const DAYS_AHEAD = 7;
const MAX_DOTS = 3;
// Espelha o h-10 da AppHeader: é a linha em que a faixa some por baixo dela.
const HEADER_PX = 40;

export const weekDays = (): Date[] => {
  const today = startOfDay(new Date());
  return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
};

/** O número do dia é o mesmo elemento na faixa e no header: o motion morfa um no outro. */
export const stripDayLayoutId = (day: Date) => `week-day-${format(day, "yyyy-MM-dd")}`;

/** Avisa o header (mobile) quando a faixa inteira já passou por baixo dele. */
function useDockWhenHidden(): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null);
  const { setStripDocked } = useDailify();
  const mobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    const strip = ref.current;
    if (!strip || !mobile) return;
    const observer = new IntersectionObserver(
      ([entry]) =>
        setStripDocked(!entry.isIntersecting && entry.boundingClientRect.top < HEADER_PX),
      { rootMargin: `-${HEADER_PX}px 0px 0px 0px` },
    );
    observer.observe(strip);
    return () => {
      observer.disconnect();
      setStripDocked(false);
    };
  }, [mobile, setStripDocked]);

  return ref;
}

/**
 * Os próximos sete dias em uma linha, com um ponto nos que têm tarefa. Substitui o mini-calendário
 * que ocupava a dobra: 42 células pra mostrar o que cabe em sete.
 *
 * Clicar rola até o dia na lista; o mês inteiro continua a um clique, no popover à direita.
 */
export function WeekStrip(): JSX.Element {
  const { tasks, goToDay } = useDailify();
  const days = weekDays();
  const ref = useDockWhenHidden();

  return (
    <div
      ref={ref}
      className="flex items-center gap-1 rounded-2xl border border-surface-line bg-surface-card p-2"
    >
      {days.map((day) => {
        const current = isToday(day);
        const dots = Math.min(tasks ? getTasksForDay(tasks, day).length : 0, MAX_DOTS);

        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => void goToDay(day)}
            className={cn(
              "flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors",
              current ? "bg-surface-hover" : "hover:bg-surface-hover",
            )}
          >
            <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
              {format(day, "EEEEEE", { locale: ptBR })}
            </span>

            <motion.span
              layoutId={stripDayLayoutId(day)}
              transition={spring.soft}
              className={cn(
                "text-sm font-medium",
                current ? "text-accent-primary" : "text-foreground",
              )}
            >
              {format(day, "d")}
            </motion.span>

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
