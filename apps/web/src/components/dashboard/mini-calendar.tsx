import { weekDays } from "@/consts/conts";
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
  const { setSelectedDay, selectedDay } = useDailify();

  const goToPreviousMonth = () => {
    // setIsLoading(true)
    setSelectedDay(subMonths(selectedDay, 1));
  };

  const goToNextMonth = () => {
    // setIsLoading(true)
    setSelectedDay(addMonths(selectedDay, 1));
  };

  const goToToday = () => {
    setSelectedDay(new Date());
  };

  const generateCalendarDays = () => {
    const monthStart = startOfMonth(selectedDay);
    const monthEnd = endOfMonth(selectedDay);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  };

  const [calendarDays, setCalendarDays] = useState<Date[]>(generateCalendarDays());

  useEffect(() => {
    const calendarDays = generateCalendarDays();
    setCalendarDays(calendarDays);
  }, [selectedDay]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
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
          {format(selectedDay, "MMMM yyyy", { locale: ptBR })}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          aria-label={copy.aside.nextMonth}
          className="size-7 rounded-full text-muted-foreground hover:bg-surface-hover"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <ul className="grid w-full grid-cols-7 justify-items-center gap-1">
          {weekDays.map((day, index) => (
            <li
              key={index}
              className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
            >
              {day.slice(0, 1)}
            </li>
          ))}
        </ul>

        <ul className="grid grid-cols-7 justify-items-center gap-1">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, selectedDay);
            const isCurrentDay = isToday(day);
            const isSelectedDay = isSameDay(day, selectedDay);

            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-mono text-xs transition-colors",
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                    isCurrentDay && "bg-accent-primary text-primary-foreground",
                    !isCurrentDay && isSelectedDay && "border border-accent-primary",
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
