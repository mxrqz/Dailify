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
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useDailify } from "../dailifyContext";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export default function Calendar3({ className }: { className?: string }) {
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
    // setIsLoading(true)
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
    <div
      className={cn("flex flex-col gap-2 bg-background rounded-md p-2 border shrink-0", className)}
    >
      <div className="w-full flex justify-between items-center">
        <Button variant={"outline"} onClick={goToPreviousMonth} className="cursor-pointer size-7">
          <ChevronLeftIcon />
        </Button>

        <Button variant={"ghost"} onClick={goToToday} className="h-7 text-lg cursor-pointer">
          {format(selectedDay, "PP")}
        </Button>

        <Button variant={"outline"} onClick={goToNextMonth} className="cursor-pointer size-7">
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <ul className="grid grid-cols-7 gap-2 w-full items-center justify-items-center">
          {weekDays.map((day, index) => (
            <li key={index} className="font-semibold text-muted-foreground">
              {day.slice(0, 2).toUpperCase()}
            </li>
          ))}
        </ul>

        <ul className="grid grid-cols-7 gap-x-1 justify-items-center">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, selectedDay);
            const isCurrentDay = isToday(day);
            const isSelectedDay = isSameDay(day, selectedDay);

            return (
              <li
                key={index}
                className={`w-full p-1 rounded-md flex items-center justify-center hover:bg-muted cursor-pointer
                                        ${!isCurrentMonth && "text-muted-foreground bg-muted opacity-30"} ${isCurrentDay && "bg-primary text-background dark:text-foreground"} 
                                        ${isSelectedDay && "bg-muted"}
                                        `}
                onClick={() => setSelectedDay(day)}
              >
                {format(day, "d")}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
