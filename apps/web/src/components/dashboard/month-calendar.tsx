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
import { AnimatePresence, motion, type Variants } from "motion/react";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { Task, WeekStart } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DaySection } from "@/components/dashboard/day-section";
import { Button } from "@/components/ui/button";
import { DESKTOP } from "@/consts/media";
import { duration, ease } from "@/consts/motion";
import { clockAt, weekdayDate, weekdayInitials } from "@/functions/date-label";
import { capitalize, fill, getCompletionDate, getTasksForDay } from "@/functions/functions";
import { zoned } from "@/functions/zone";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNow } from "@/hooks/useNow";
import { openPanel, usePanel } from "@/hooks/usePanel";
import { cn } from "@/lib/utils";

// Forward (dir 1) pushes the day out left and the next in from the right; dir 0 swaps instantly.
const slide = { duration: duration.slow, ease: ease.out };
const page = {
  enter: (dir: number) => ({ x: `${dir * 100}%`, transition: dir ? slide : { duration: 0 } }),
  center: (dir: number) => ({ x: "0%", transition: dir ? slide : { duration: 0 } }),
  exit: (dir: number) => ({ x: `${-dir * 100}%`, transition: dir ? slide : { duration: 0 } }),
} satisfies Variants;

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
  /** `keyboard`: a click with no pointer, which swaps the day without the slide. */
  onPick: (day: Date, keyboard: boolean) => void;
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
      {weekdayInitials(weekStart).map((initial, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="pb-1.5 text-center text-xs font-medium text-ink-secondary"
        >
          {initial}
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
            aria-label={has ? fill(copy.day.withTasks, { day: label }) : label}
            onClick={(e) => onPick(day, e.detail === 0)}
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

/** Tasks a desktop cell lists before the "+N mais". */
const CELL_TASKS = 3;

/**
 * The desktop month (props → markup): a full-height grid of cells, each with the day number (today
 * in a `brand` circle) and its first tasks as "HH:MM title" lines in clock order.
 */
export function MonthBoard({
  month,
  today,
  selected,
  weekStart,
  hour12,
  tasksOf,
  onPick,
}: {
  month: Date;
  today: Date;
  selected: number | null;
  weekStart: WeekStart;
  hour12: boolean;
  tasksOf: (day: Date) => readonly Task[];
  onPick: (day: Date) => void;
}): JSX.Element {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const lead = (days[0].getDay() - weekStart + 7) % 7;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div aria-hidden="true" className="grid grid-cols-7 gap-1.5 pb-2">
        {weekdayInitials(weekStart, copy.aside.weekDayShort).map((name) => (
          <div key={name} className="px-2 text-footnote font-medium text-ink-secondary">
            {name}
          </div>
        ))}
      </div>
      <div
        role="group"
        aria-label={format(month, "MMMM 'de' yyyy", { locale: ptBR })}
        className="grid flex-1 auto-rows-fr grid-cols-7 gap-1.5"
      >
        {Array.from({ length: lead }, (_, i) => (
          <span key={`b${i}`} aria-hidden="true" />
        ))}
        {days.map((day) => {
          const list = [...tasksOf(day)].sort((a, b) => a.date - b.date);
          const label = weekdayDate(day, "EEEE, d 'de' MMMM");
          const isCurrent = isSameDay(day, today);
          return (
            <button
              key={day.getTime()}
              type="button"
              aria-pressed={selected === day.getTime()}
              aria-current={isCurrent ? "date" : undefined}
              aria-label={list.length ? fill(copy.day.withTasks, { day: label }) : label}
              onClick={() => onPick(day)}
              className="flex min-h-28 min-w-0 cursor-pointer flex-col gap-0.5 overflow-hidden rounded-md bg-surface p-1.5 text-left outline -outline-offset-1 outline-card-edge transition-colors duration-fast hover:bg-fill focus-visible:outline-2 focus-visible:outline-brand-text aria-pressed:bg-brand-soft"
            >
              <span
                className={cn(
                  "mb-0.5 grid size-7 flex-none place-items-center rounded-full text-subhead font-semibold tabular-nums",
                  isCurrent
                    ? "bg-brand text-on-brand"
                    : isBefore(day, today)
                      ? "text-ink-secondary"
                      : "text-ink",
                )}
              >
                {format(day, "d")}
              </span>
              {list.slice(0, CELL_TASKS).map((task) => (
                <span
                  key={`${task.id}-${task.date}`}
                  className={cn(
                    "truncate px-1 text-footnote",
                    getCompletionDate(task, day) === true && "text-ink-secondary line-through",
                  )}
                >
                  <span className="text-ink-secondary tabular-nums">
                    {clockAt(task.date, hour12)}
                  </span>{" "}
                  {task.title}
                </span>
              ))}
              {list.length > CELL_TASKS && (
                <span className="px-1 text-footnote font-medium text-ink-secondary">
                  {fill(copy.day.more, { n: list.length - CELL_TASKS })}
                </span>
              )}
            </button>
          );
        })}
      </div>
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
  const { tasks, selectedDay, goToDay, loadMonth, weekStart, hour12 } = useDailify();
  const desktop = useMediaQuery(DESKTOP);
  const panel = usePanel();
  const today = useNow("day");
  const [month, setMonth] = useState(() => startOfMonth(selectedDay));
  const monthKey = month.getTime();

  const loadMonthOf = useEffectEvent(loadMonth);
  useEffect(() => {
    void loadMonthOf(zoned(monthKey));
  }, [monthKey]);

  // The day lands after goToDay loads its months, so the input that picked it is kept until then.
  const [keyboard, setKeyboard] = useState(false);
  const dayKey = startOfDay(selectedDay).getTime();
  const [shown, setShown] = useState(dayKey);
  const [dir, setDir] = useState(0);
  if (dayKey !== shown) {
    setShown(dayKey);
    setDir(keyboard ? 0 : Math.sign(dayKey - shown));
  }

  const pick = (day: Date) => void goToDay(day);
  const marked = (day: Date) => (tasks ? getTasksForDay(tasks, day).length > 0 : false);
  const title = format(month, "MMMM", { locale: ptBR });

  if (desktop) {
    // The sidebar is the way back, so there's no Voltar; a cell opens its day in the side panel.
    return (
      <div className="flex min-h-0 flex-1 flex-col px-8 pt-1 pb-8">
        <header className="flex items-end justify-between gap-3 pb-5">
          <h1 className="text-title-1">
            {capitalize(title)}{" "}
            <span className="font-normal text-ink-secondary">{format(month, "yyyy")}</span>
          </h1>
          <div className="flex items-center gap-1 pb-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={copy.aside.prevMonth}
              onClick={() => setMonth(addMonths(month, -1))}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMonth(startOfMonth(today))}>
              {copy.day.today}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={copy.aside.nextMonth}
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          </div>
        </header>
        <MonthBoard
          month={month}
          today={today}
          selected={panel?.kind === "day" ? panel.day : null}
          weekStart={weekStart}
          hour12={hour12}
          tasksOf={(day) => (tasks ? getTasksForDay(tasks, day) : [])}
          onPick={(day) => openPanel({ kind: "day", day: day.getTime() })}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-float overflow-y-auto overscroll-contain bg-canvas pb-30 md:static md:z-auto md:overflow-visible md:pb-10">
      {/* Not a landmark: two buttons, no links, and the Sidebar already owns "Navegação". */}
      <div className="sticky top-0 z-10 flex h-bar items-center justify-between bg-material-bar-solid px-2 md:top-13">
        <Button variant="ghost" size="bar" aria-label={copy.header.back} onClick={onClose}>
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          onClick={(e) => {
            setMonth(startOfMonth(zoned()));
            setKeyboard(e.detail === 0);
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
          <Button
            variant="ghost"
            size="bar"
            aria-label={copy.aside.prevMonth}
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeftIcon aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="bar"
            aria-label={copy.aside.nextMonth}
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        </div>
      </header>

      <MonthGrid
        month={month}
        selected={selectedDay}
        weekStart={weekStart}
        marked={marked}
        onPick={(day, keyboard) => {
          if (!isSameMonth(day, month)) setMonth(startOfMonth(day));
          setKeyboard(keyboard);
          pick(day);
        }}
      />

      <hr className="mx-5 mt-3 border-separator" />

      <div className="flex flex-col gap-3 px-4 pt-7">
        {/* A pager: popLayout lifts the leaving day out of the flow, so both slide at once. */}
        <div className="relative overflow-x-clip">
          <AnimatePresence initial={false} mode="popLayout" custom={dir}>
            <motion.div
              key={dayKey}
              custom={dir}
              variants={page}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <DaySection calendar day={startOfDay(selectedDay)} />
            </motion.div>
          </AnimatePresence>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => onCreateOn(selectedDay)}>
          <PlusIcon aria-hidden="true" />
          {fill(copy.day.createOn, { day: format(selectedDay, "EEE, d MMM", { locale: ptBR }) })}
        </Button>
      </div>
    </div>
  );
}
