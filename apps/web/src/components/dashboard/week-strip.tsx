import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { motion } from "motion/react";
import { format, isSameDay, isToday } from "date-fns";

import { APP_BAR_ID } from "@/components/app-header";
import { useDailify } from "@/components/dailifyContext";
import { duration, ease } from "@/consts/motion";
import { copy } from "@/components/dashboard/copy";
import { ScheduleDrop } from "@/components/dashboard/anytime-block";
import { dayAnchorId } from "@/components/dashboard/day-section";
import { MonthPicker } from "@/components/dashboard/month-calendar";
import { dockProgress, dockTransform } from "@/components/dashboard/strip-dock";
import { weekdayDate, weekOf } from "@/functions/date-label";
import { fill, getTasksForDay } from "@/functions/functions";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";

// A section is the day being read once its top rises this far below the strip or the bar.
const READING_GAP_PX = 16;

// The mobile bar, hidden (all zeros) on desktop.
const bar = () => document.getElementById(APP_BAR_ID);
const rectOf = (el: Element | null) => el?.getBoundingClientRect() ?? new DOMRect();

/** O dia cuja seção está sendo lida no topo da lista; um clique fixa o dia até o próximo gesto. */
function useVisibleDay(days: Date[], strip: RefObject<HTMLElement | null>): string | undefined {
  const { tasks, targetDay } = useDailify();
  const [visible, setVisible] = useState<string>();
  const [pinned, setPinned] = useState<string>();
  const firstDay = days[0].getTime();
  // `days` é um array novo a cada render; quem dispara a releitura é o `firstDay`.
  const inWeek = useEffectEvent((id: string) => days.some((day) => dayAnchorId(day) === id));

  useEffect(() => {
    let frame = 0;
    // O dia "atual" é a última seção cujo topo já passou da linha de leitura (logo abaixo da barra);
    // lido na rolagem, e não por observer, porque as seções nascem depois (cache, meses chegando).
    const update = () => {
      frame = 0;
      const box = rectOf(strip.current);
      const barBottom = rectOf(bar()).bottom;
      // Docked, the strip sits in the bar: its own box still reaches below it.
      const line =
        (dockProgress(box.top, barBottom) === 1 ? barBottom : box.bottom) + READING_GAP_PX;
      const sections = document.querySelectorAll<HTMLElement>("section[data-day]");
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top > line) break;
        current = section;
      }
      setVisible(current && inWeek(current.id) ? current.id : undefined);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
    // Reavalia quando a lista muda; os dias da semana só mudam à meia-noite.
  }, [tasks, firstDay, strip]);

  useEffect(() => {
    if (!targetDay) return;
    setPinned(dayAnchorId(targetDay));
    // Rolagem programática não dispara estes eventos: só o dedo, a roda ou o teclado soltam o dia.
    const release = () => setPinned(undefined);
    const events = ["touchstart", "wheel", "keydown"] as const;
    for (const event of events) window.addEventListener(event, release, { passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, release);
    };
  }, [targetDay]);

  return pinned ?? visible;
}

/**
 * A semana em sete pílulas (props → markup). A escolhida é a pílula `ink`, que desliza até o dia
 * novo; o ponto de "tem tarefa" fica FORA dela, embaixo, pra ler igual escolhida ou não.
 */
export function WeekDays({
  days,
  selected,
  marked,
  onPick,
  wrap = (_, node) => node,
}: {
  days: Date[];
  selected?: Date;
  marked: (day: Date) => boolean;
  onPick: (day: Date) => void;
  /** Envolve cada dia (o alvo de soltar do desktop). */
  wrap?: (day: Date, node: JSX.Element) => ReactNode;
}): JSX.Element {
  const pill = useId();
  // Picked by keyboard (a click with no pointer): the pill jumps instead of sliding.
  const [instant, setInstant] = useState(false);
  return (
    <div role="group" aria-label={copy.day.week} className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const on = selected !== undefined && isSameDay(day, selected);
        const label = weekdayDate(day, "EEEE, d 'de' MMMM");
        const has = marked(day);
        return (
          <div key={day.getTime()} className="flex flex-col items-center gap-1.5">
            {wrap(
              day,
              <button
                type="button"
                onClick={(e) => {
                  setInstant(e.detail === 0);
                  onPick(day);
                }}
                aria-pressed={on}
                aria-current={isToday(day) ? "date" : undefined}
                aria-label={has ? fill(copy.day.withTasks, { day: label }) : label}
                className={cn(
                  "relative flex h-13 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md transition-colors duration-fast",
                  "data-drop-over:outline-2 data-drop-over:-outline-offset-2 data-drop-over:outline-brand",
                  on ? "text-canvas" : "hover:bg-fill pointer-fine:active:bg-fill-pressed",
                )}
              >
                {on && (
                  <motion.span
                    layoutId={pill}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-md bg-ink"
                    transition={
                      instant ? { duration: 0 } : { duration: duration.slow, ease: ease.out }
                    }
                  />
                )}
                <small
                  className={cn(
                    "relative text-xs font-medium",
                    on ? "text-ink-tertiary" : "text-ink-secondary",
                  )}
                >
                  {copy.aside.weekDayInitials[day.getDay()]}
                </small>
                <span
                  className={cn(
                    "relative text-body font-semibold tabular-nums",
                    !on && isToday(day) && "text-brand-text",
                  )}
                >
                  {format(day, "d")}
                </span>
              </button>,
            )}
            <i
              aria-hidden="true"
              className={cn(
                "size-1 rounded-full opacity-(--undock)",
                has ? "bg-ink-secondary" : "bg-transparent",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

/** A semana de hoje (respeitando o primeiro dia da config); muda só à meia-noite. */
export function useWeek(): Date[] {
  const { weekStart } = useDailify();
  return weekOf(useNow("day"), weekStart);
}

/**
 * The Today week: the pill follows the day being read, a tap scrolls to it. Desktop, it sticks
 * under the toolbar. Mobile, it scrolls up over the bar and docks there (`strip-dock.ts`), the bar's
 * actions fading under `--undock`. `expanded` (mobile `?view=calendar`) swaps it for the month,
 * in the flow; a pick collapses it, then scrolls.
 */
export function WeekStrip({
  expanded = false,
  onCollapse,
}: {
  expanded?: boolean;
  onCollapse?: () => void;
}): JSX.Element {
  const { tasks, goToDay, selectedDay } = useDailify();
  const days = useWeek();
  const strip = useRef<HTMLDivElement>(null);
  const week = useRef<HTMLDivElement>(null);
  const visible = useVisibleDay(days, strip);
  // Scrolled only once the strip is back to its week height, or the day lands under the month.
  const [picked, setPicked] = useState<Date | null>(null);
  const go = useEffectEvent((day: Date) => void goToDay(day));
  useEffect(() => {
    if (expanded || !picked) return;
    go(picked);
    setPicked(null);
  }, [expanded, picked]);

  useEffect(() => {
    const root = document.documentElement.style;
    const el = week.current;
    if (expanded || !el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const header = bar();
      const box = rectOf(strip.current);
      const p = dockProgress(box.top, rectOf(header).bottom);
      const menu = rectOf(header?.firstElementChild ?? null);
      el.style.transform = p
        ? dockTransform(
            p,
            { left: box.left + el.offsetLeft, width: el.offsetWidth },
            { left: menu.right + 4, right: window.innerWidth - 8 },
          )
        : "";
      root.setProperty("--undock", String(1 - p));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      el.style.transform = "";
      root.removeProperty("--undock");
    };
  }, [expanded]);

  return (
    // Taps go to the week only: docked, the strip's box still covers a band under the bar.
    <div
      ref={strip}
      className={cn(
        "pointer-events-none relative -mx-4 mt-2 px-4 py-2 md:sticky md:top-13 md:z-10 md:-mx-8 md:px-8",
        !expanded && "sticky top-inset z-float",
      )}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-canvas opacity-(--undock)" />
      <div ref={week} className="pointer-events-auto relative origin-top-left">
        {expanded ? (
          <MonthPicker
            selected={selectedDay}
            onPick={(day) => {
              setPicked(day);
              onCollapse?.();
            }}
          />
        ) : (
          <WeekDays
            days={days}
            selected={days.find((day) => dayAnchorId(day) === visible)}
            marked={(day) => (tasks ? getTasksForDay(tasks, day).length > 0 : false)}
            onPick={(day) => void goToDay(day)}
            wrap={(day, node) => <ScheduleDrop day={day}>{node}</ScheduleDrop>}
          />
        )}
      </div>
    </div>
  );
}
