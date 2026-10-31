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
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState, useEffect } from "react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MiniCalendar() {
  const { goToDay, selectedDay, weekStart } = useDailify();
  // As setas só folheiam: o dia escolhido (e a lista) muda só com clique num dia.
  const [viewMonth, setViewMonth] = useState(selectedDay);

  // Dia de outro mês clicado na grade (ou `goToDay` vindo de fora) traz a grade junto.
  useEffect(() => setViewMonth(selectedDay), [selectedDay]);

  const goToToday = () => {
    const today = new Date();
    setViewMonth(today);
    void goToDay(today);
  };

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: weekStart }),
    end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: weekStart }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewMonth(subMonths(viewMonth, 1))}
          aria-label={copy.aside.prevMonth}
          className="size-7 rounded-full text-muted-foreground hover:bg-surface-hover"
        >
          <ChevronLeftIcon />
        </Button>

        <button
          type="button"
          onClick={goToToday}
          className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {format(viewMonth, "MMMM yyyy", { locale: ptBR })}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          aria-label={copy.aside.nextMonth}
          className="size-7 rounded-full text-muted-foreground hover:bg-surface-hover"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <ul className="grid w-full grid-cols-7 justify-items-center gap-1">
          {copy.aside.weekDayInitials
            .map((_, index) => copy.aside.weekDayInitials[(index + weekStart) % 7])
            .map((day, index) => (
              <li
                key={index}
                className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
              >
                {day}
              </li>
            ))}
        </ul>

        <ul className="grid grid-cols-7 justify-items-center gap-1">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, viewMonth);
            const isCurrentDay = isToday(day);
            const isSelectedDay = isSameDay(day, selectedDay);

            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => void goToDay(day)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-mono text-xs transition-colors",
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                    isCurrentDay && "bg-accent-primary text-primary-foreground",
                    !isCurrentDay && isSelectedDay && "border border-foreground",
                    !isCurrentDay && !isSelectedDay && "hover:bg-surface-hover",
                  )}
                >
                  {format(day, "d")}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
