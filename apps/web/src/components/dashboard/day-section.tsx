import { useEffect, useRef } from "react";
import { duration, ease } from "@/consts/motion";
import { format, isToday, isTomorrow } from "date-fns";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { durationMinutes } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { AnytimeBlock, ScheduleDrop } from "@/components/dashboard/anytime-block";
import { copy } from "@/components/dashboard/copy";
import { dayRows, isDayZeroed, type Row } from "@/components/dashboard/day-rows";
import { DayTaskRow, NowLine } from "@/components/dashboard/day-task-row";
import { SHEET_EDITING } from "@/consts/media";
import { TaskCard } from "@/components/task-card";
import { countLabel } from "@/functions/count-label";
import { clockAt, dayLabel, weekdayDate } from "@/functions/date-label";
import { getCompletionDate, getTasksForDay, getTime, timeToMinutes } from "@/functions/functions";
import { isSaving } from "@/hooks/useCreateTask";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNow } from "@/hooks/useNow";
import type { Task } from "@dailify/shared";

const SKELETON_ROWS = 3;

/** Id da seção de um dia — a `DayList` usa isto pra rolar até ele. */
export const dayAnchorId = (day: Date) => `day-${format(day, "yyyy-MM-dd")}`;

// Shaped like the rows that replace it (TaskRow when sheet-editing), so boot doesn't shift layout.
export function TaskSkeletons(): JSX.Element {
  const sheetEditing = useMediaQuery(SHEET_EDITING);
  return (
    <ul className={sheetEditing ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <li key={i}>
          {sheetEditing ? (
            <div className="card skeleton min-h-16 rounded-md" />
          ) : (
            <TaskCard loading time="" title="" duration="" tags={["", ""]} />
          )}
        </li>
      ))}
    </ul>
  );
}

const itemCount = (count: number): string =>
  countLabel(count, copy.day.oneItem, copy.day.manyItems);

// A done task settling at the end, and neighbours making room for a row that comes or goes.
const settle = { layout: { duration: duration.slow, ease: ease.out } };
// Slides out left fading (45%), then gives its height back: 340ms in all, as approved (bd dgb.4).
const SLIDE = 0.153;
const COLLAPSE = { delay: SLIDE, duration: 0.187, ease: ease.exit };
const exit = {
  x: "-40%",
  opacity: 0,
  height: 0,
  // Takes the list's gap-2 along, so the rows below land flush.
  marginBottom: -8,
  transition: {
    x: { duration: SLIDE, ease: ease.exit },
    opacity: { duration: SLIDE, ease: ease.exit },
    height: COLLAPSE,
    marginBottom: COLLAPSE,
  },
};
const instantExit = { opacity: 0, transition: { duration: 0 } };

/**
 * Um dia: cabeçalho (rótulo + contagem) e as linhas embaixo — tarefas e, hoje, o fio do agora. É o bloco que a `DayList` empilha; o scroll é da página, não daqui.
 */
export function DaySection({
  day,
  calendar,
}: {
  day: Date;
  /** O dia escolhido no calendário: título "Terça, 17", sem o bloco A qualquer hora. */
  calendar?: boolean;
}): JSX.Element {
  const { tasks, hour12, weekStart } = useDailify();
  const reduce = useReducedMotion();
  const sheetEditing = useMediaQuery(SHEET_EDITING);
  const isCurrentDay = isToday(day);
  // Só hoje tem o fio do agora; os outros dias só mudam (rótulo) na virada do dia.
  const now = useNow(isCurrentDay ? 60_000 : "day");
  const dayTasks = tasks ? getTasksForDay(tasks, day) : [];
  const nowAt = now.getHours() * 60 + now.getMinutes();
  // Tarefas e o fio do agora numa ordem só. O fio fica antes do que começa agora (-0.5): o que já
  // começou fica acima dele.
  const timed: Row[] = dayTasks.map((task) => ({
    at: timeToMinutes(getTime(task.date, "HH:MM")),
    task,
  }));
  if (isCurrentDay && timed.length) timed.push({ at: nowAt - 0.5, now: true });
  const done = (task: Task) => getCompletionDate(task, day) === true;
  const rows = dayRows(timed, done);
  const zeroed = isDayZeroed(dayTasks, done);
  const live = (row: { at: number; task: Task }) =>
    isCurrentDay && row.at <= nowAt && nowAt < row.at + durationMinutes(row.task.duration);
  const count = dayTasks.length;
  const sub =
    isTomorrow(day) && !calendar ? weekdayDate(day, "EEEE, d MMM") : count > 0 && itemCount(count);

  // One pulse when the last task gets done, never when a zeroed day mounts.
  const heading = useRef<HTMLHeadingElement>(null);
  const wasZeroed = useRef(zeroed);
  useEffect(() => {
    const became = zeroed && !wasZeroed.current;
    wasZeroed.current = zeroed;
    if (!became || reduce) return;
    heading.current?.animate([{ scale: "1" }, { scale: "1.06" }, { scale: "1" }], {
      duration: duration.open * 1000,
      easing: `cubic-bezier(${ease.out.join()})`,
    });
  }, [zeroed, reduce]);

  const listVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.05 } },
  };
  const rowVariants: Variants = {
    hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 },
    enter: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 6 },
    // `fresh` (custom): a row the composer just created enters quicker than the day's stagger.
    visible: (fresh: boolean) => ({
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0 : fresh ? duration.base : duration.slow, ease: ease.out },
    }),
  };

  return (
    <ScheduleDrop day={day}>
      {/* content-visibility só no mobile: no desktop cortaria o contorno de soltar (outline-offset). */}
      <section
        id={calendar ? undefined : dayAnchorId(day)}
        // What the WeekStrip queries (`section[data-day]`), so it never re-types the id format.
        data-day={calendar ? undefined : true}
        className="flex scroll-mt-bar max-md:[contain-intrinsic-size:auto_20rem] max-md:[content-visibility:auto] flex-col gap-2 rounded-lg outline-offset-4 data-drop-over:outline-2 data-drop-over:outline-dashed data-drop-over:outline-brand"
      >
        <header className="flex items-baseline justify-between gap-3 px-1 pb-1">
          <h2 ref={heading} className="origin-left text-title-3 font-semibold">
            {calendar ? weekdayDate(day, "EEEE, d") : dayLabel(day, now, weekStart)}
          </h2>
          {zeroed ? (
            <span className="text-footnote font-semibold text-success transition-opacity duration-base starting:opacity-0">
              {copy.day.zeroed}
            </span>
          ) : (
            sub && <span className="text-footnote text-ink-secondary">{sub}</span>
          )}
        </header>

        {isCurrentDay && !calendar && <AnytimeBlock />}

        {(!isCurrentDay || calendar) && rows.length === 0 && (
          <p className="px-1 text-subhead text-ink-secondary">{copy.day.emptyDay}</p>
        )}

        {rows.length > 0 && (
          <motion.ul
            className="flex flex-col gap-2"
            variants={listVariants}
            // Só hoje (e o dia do calendário) entra escalonado: meses que chegam no meio da rolagem
            // não animam linha por linha.
            initial={reduce || (!isCurrentDay && !calendar) ? false : "hidden"}
            animate="visible"
          >
            {/* No `initial={false}`: it would block the ul's stagger on mount. */}
            <AnimatePresence>
              {rows.map((row) =>
                "task" in row ? (
                  <motion.li
                    key={row.task.id}
                    layout="position"
                    variants={rowVariants}
                    custom={isSaving(row.task)}
                    // Just created: a subtle entry at its slot instead of the day's stagger.
                    initial={isSaving(row.task) ? "enter" : undefined}
                    exit={reduce ? instantExit : exit}
                    transition={settle}
                  >
                    <DayTaskRow
                      task={row.task}
                      day={day}
                      hour={row.hour}
                      live={live(row)}
                      sheetEditing={sheetEditing}
                    />
                  </motion.li>
                ) : (
                  <motion.li key="now" layout="position" transition={settle}>
                    <NowLine time={clockAt(now, hour12)} />
                  </motion.li>
                ),
              )}
            </AnimatePresence>
          </motion.ul>
        )}
      </section>
    </ScheduleDrop>
  );
}
