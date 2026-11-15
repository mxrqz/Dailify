import { useEffect, useState } from "react";
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
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { cn } from "@/lib/utils";

const navButton =
  "flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground";

/**
 * Calendário de um dia: fechado mostra só a semana do dia escolhido numa linha; o chevron abre o
 * mês inteiro, com as setas de mês. Serve pra navegar a lista e pra remarcar uma tarefa.
 */
export function DayPicker({
  value,
  onSelect,
}: {
  value: Date;
  onSelect: (day: Date) => void;
}): JSX.Element {
  const { weekStart } = useDailify();
  const [open, setOpen] = useState(false);
  // As setas só folheiam: o dia escolhido muda só com clique num dia.
  const [viewMonth, setViewMonth] = useState(value);
  useEffect(() => setViewMonth(value), [value]);

  const opts = { weekStartsOn: weekStart };
  const days = open
    ? eachDayOfInterval({
        start: startOfWeek(startOfMonth(viewMonth), opts),
        end: endOfWeek(endOfMonth(viewMonth), opts),
      })
    : eachDayOfInterval({ start: startOfWeek(value, opts), end: endOfWeek(value, opts) });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        {open && (
          <button
            type="button"
            aria-label={copy.aside.prevMonth}
            onClick={() => setViewMonth(subMonths(viewMonth, 1))}
            className={navButton}
          >
            <ChevronLeftIcon className="size-4" />
          </button>
        )}
        <span className="flex-1 px-1 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {format(open ? viewMonth : value, "MMMM yyyy", { locale: ptBR })}
        </span>
        {open && (
          <button
            type="button"
            aria-label={copy.aside.nextMonth}
            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
            className={navButton}
          >
            <ChevronRightIcon className="size-4" />
          </button>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? copy.day.collapseMonth : copy.day.expandMonth}
          onClick={() => {
            setOpen(!open);
            setViewMonth(value);
          }}
          className={navButton}
        >
          <ChevronDownIcon className={cn("size-4 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      <ul className="grid grid-cols-7 justify-items-center gap-1">
        {copy.aside.weekDayInitials
          .map((_, index) => copy.aside.weekDayInitials[(index + weekStart) % 7])
          .map((initial, index) => (
            <li
              key={index}
              className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
            >
              {initial}
            </li>
          ))}
        {days.map((day) => {
          const selected = isSameDay(day, value);
          return (
            <li key={day.getTime()}>
              <button
                type="button"
                aria-pressed={selected}
                aria-label={format(day, "d 'de' MMMM", { locale: ptBR })}
                onClick={() => onSelect(day)}
                className={cn(
                  "flex size-8 cursor-pointer items-center justify-center rounded-lg font-mono text-xs transition-colors",
                  open && !isSameMonth(day, viewMonth)
                    ? "text-muted-foreground"
                    : "text-foreground",
                  isToday(day) && "text-brand-text",
                  selected ? "bg-surface-line" : "hover:bg-surface-hover",
                )}
              >
                {format(day, "d")}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
