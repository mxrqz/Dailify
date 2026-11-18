import { useEffect, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { WeekStart } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DaySection, weekdayDate } from "@/components/dashboard/day-section";
import { Button } from "@/components/ui/button";
import { capitalize, getTasksForDay } from "@/functions/functions";
import { zoned } from "@/functions/zone";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { cn } from "@/lib/utils";

const iconButton =
  "grid size-11 cursor-pointer place-items-center rounded-full text-ink transition-colors hover:bg-fill pointer-fine:active:bg-fill-pressed [&_svg]:size-5.5";

/**
 * O mês em grade (props → markup): passado apagado, hoje em `brand-text`, o escolhido num círculo
 * `ink`, e o ponto de "tem tarefa" embaixo do número.
 */
export function MonthGrid({
  month,
  selected,
  weekStart,
  marked,
  onPick,
}: {
  month: Date;
  selected: Date;
  weekStart: WeekStart;
  marked: (day: Date) => boolean;
  onPick: (day: Date) => void;
}): JSX.Element {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const lead = (days[0].getDay() - weekStart + 7) % 7;
  const today = startOfDay(zoned());

  return (
    <div
      role="group"
      aria-label={format(month, "MMMM 'de' yyyy", { locale: ptBR })}
      className="grid grid-cols-7 gap-y-0.5 px-4 pt-3"
    >
      {copy.aside.weekDayInitials.map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="pb-1.5 text-center text-xs font-medium text-ink-secondary"
        >
          {copy.aside.weekDayInitials[(i + weekStart) % 7]}
        </div>
      ))}
      {Array.from({ length: lead }, (_, i) => (
        <span key={`b${i}`} aria-hidden="true" />
      ))}
      {days.map((day) => {
        const on = isSameDay(day, selected);
        const label = weekdayDate(day, "EEEE, d 'de' MMMM");
        const has = marked(day);
        return (
          <button
            key={day.getTime()}
            type="button"
            aria-pressed={on}
            aria-current={isToday(day) ? "date" : undefined}
            aria-label={has ? copy.day.withTasks.replace("{day}", label) : label}
            onClick={() => onPick(day)}
            className="group/day flex h-13 cursor-pointer flex-col items-center gap-1 pt-0.5"
          >
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full text-body font-medium tabular-nums transition-colors",
                on
                  ? "bg-ink font-semibold text-canvas"
                  : isToday(day)
                    ? "font-bold text-brand-text group-hover/day:bg-fill"
                    : cn(
                        "group-hover/day:bg-fill",
                        isBefore(day, today) ? "text-ink-secondary" : "text-ink",
                      ),
              )}
            >
              {format(day, "d")}
            </span>
            <i
              aria-hidden="true"
              className={cn("size-1.25 rounded-full", has ? "bg-ink-secondary" : "bg-transparent")}
            />
          </button>
        );
      })}
    </div>
  );
}

/**
 * O calendário da Hoje (o ícone da barra): o mês com setas, e embaixo o dia escolhido. Escolher um
 * dia é o `goToDay` — ao voltar, a lista já está nele. No mobile cobre a tela (barra própria, com
 * Voltar e Hoje); no desktop ocupa o lugar da agenda.
 */
export function MonthCalendar({
  onClose,
  onCreateOn,
}: {
  onClose: () => void;
  onCreateOn: (day: Date) => void;
}): JSX.Element {
  const { tasks, selectedDay, goToDay, loadMonth, weekStart } = useDailify();
  const [month, setMonth] = useState(() => startOfMonth(selectedDay));
  const monthKey = month.getTime();

  const loadMonthOf = useEffectEvent(loadMonth);
  useEffect(() => {
    void loadMonthOf(zoned(monthKey));
  }, [monthKey]);

  const pick = (day: Date) => void goToDay(day);
  const marked = (day: Date) => (tasks ? getTasksForDay(tasks, day).length > 0 : false);
  const title = format(month, "MMMM", { locale: ptBR });

  return (
    <div className="fixed inset-0 z-float overflow-y-auto overscroll-contain bg-canvas pb-30 md:static md:z-auto md:overflow-visible md:pb-10">
      {/* Not a landmark: two buttons, no links, and the Sidebar already owns "Navegação". */}
      <div className="sticky top-0 z-10 flex h-bar items-center justify-between bg-material-bar-solid px-2 md:top-10">
        <button
          type="button"
          aria-label={copy.header.back}
          onClick={onClose}
          className={iconButton}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </button>
        <Button
          variant="ghost"
          onClick={() => {
            setMonth(startOfMonth(zoned()));
            pick(startOfDay(zoned()));
          }}
        >
          {copy.day.today}
        </Button>
      </div>

      <header className="flex items-end justify-between pt-1 pr-3 pl-5">
        <h1 className="text-title-1">
          {capitalize(title)}{" "}
          <span className="font-normal text-ink-secondary">{format(month, "yyyy")}</span>
        </h1>
        <div className="flex">
          <button
            type="button"
            aria-label={copy.aside.prevMonth}
            onClick={() => setMonth(addMonths(month, -1))}
            className={iconButton}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={copy.aside.nextMonth}
            onClick={() => setMonth(addMonths(month, 1))}
            className={iconButton}
          >
            <ChevronRightIcon aria-hidden="true" />
          </button>
        </div>
      </header>

      <MonthGrid
        month={month}
        selected={selectedDay}
        weekStart={weekStart}
        marked={marked}
        onPick={(day) => {
          if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
          pick(day);
        }}
      />

      <hr className="mx-5 mt-3 border-separator" />

      <div className="flex flex-col gap-3 px-4 pt-7">
        <DaySection calendar day={startOfDay(selectedDay)} />
        <Button variant="secondary" className="w-full" onClick={() => onCreateOn(selectedDay)}>
          <PlusIcon aria-hidden="true" />
          {copy.day.createOn.replace("{day}", format(selectedDay, "EEE, d MMM", { locale: ptBR }))}
        </Button>
      </div>
    </div>
  );
}
