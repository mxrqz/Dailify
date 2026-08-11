import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { MonthDayCell } from "@/components/dashboard/month-day-cell";
import NewTask from "@/components/new-task";
import NewTaskVoice from "@/components/new-task-voice";
import { Button } from "@/components/ui/button";
import { getTasksForDay } from "@/functions/functions";

/**
 * View do mês — a mesma janela da `DayView`: chrome com o mês e a navegação, e o grid por baixo.
 * A célula vive em `month-day-cell.tsx` porque ela cresceu o bastante para ter vida própria
 * (estado de hoje/selecionado/fora-do-mês + a lista de tarefas + a sheet).
 *
 * A semana começa no DOMINGO, como todo o resto do app (`weekDays` em consts indexa 0=Sunday e a
 * recorrência semanal depende disso). Os rótulos vêm de `copy.aside.weekDayInitials`.
 */
export function MonthView(): JSX.Element {
  const { selectedDay, setSelectedDay, tasks, isLoading } = useDailify();
  const reduce = useReducedMotion();

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(selectedDay)),
    end: endOfWeek(endOfMonth(selectedDay)),
  });

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.25, ease: "easeOut" }}
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-surface-line bg-surface-card shadow-panel"
    >
      <header className="flex items-center justify-between border-b border-surface-line px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {format(selectedDay, "MMMM yyyy", { locale: ptBR })}
          </span>
          {isLoading && (
            <Loader2
              className="size-3.5 shrink-0 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <NewTask className="h-8 rounded-full bg-accent-primary px-4 text-primary-foreground hover:bg-accent-hover" />
          <NewTaskVoice />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={copy.month.prevMonth}
              onClick={() => setSelectedDay(subMonths(selectedDay, 1))}
              className="size-8 rounded-full text-muted-foreground hover:bg-surface-hover"
            >
              <ChevronLeft className="size-4" />
            </Button>

            <Button
              variant="ghost"
              onClick={() => setSelectedDay(new Date())}
              className="h-8 rounded-full px-3 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              {copy.month.today}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              aria-label={copy.month.nextMonth}
              onClick={() => setSelectedDay(addMonths(selectedDay, 1))}
              className="size-8 rounded-full text-muted-foreground hover:bg-surface-hover"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-6">
        <div className="grid grid-cols-7 gap-1">
          {copy.aside.weekDayInitials.map((label, index) => (
            <span
              key={index}
              className="text-center font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>

        <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1">
          {days.map((day) => (
            <MonthDayCell
              key={day.toISOString()}
              day={day}
              tasks={tasks ? getTasksForDay(tasks, day) : []}
              isCurrentMonth={isSameMonth(day, selectedDay)}
              isSelected={isSameDay(day, selectedDay)}
              isCurrentDay={isToday(day)}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
