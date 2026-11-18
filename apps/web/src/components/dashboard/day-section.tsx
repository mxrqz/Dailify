import { duration, ease } from "@/consts/motion";
import { format, isToday, isTomorrow } from "date-fns";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { durationMinutes } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { AnytimeBlock, ScheduleDrop } from "@/components/dashboard/anytime-block";
import { copy } from "@/components/dashboard/copy";
import { DayTaskRow, NowLine, SHEET_EDITING } from "@/components/dashboard/day-task-row";
import { TaskCard } from "@/components/task-card";
import { countLabel } from "@/functions/count-label";
import { clockAt, dayLabel, weekdayDate } from "@/functions/date-label";
import { getTasksForDay, getTime, groupTasksByHour, timeToMinutes } from "@/functions/functions";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNow } from "@/hooks/useNow";
import type { TaskProps } from "@/types/types";

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

type Row = { at: number; task: TaskProps; hour?: string } | { at: number; now: true };

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
  const rows: Row[] = groupTasksByHour(dayTasks).flatMap((group) =>
    group.tasks.map((task, index) => ({
      at: timeToMinutes(getTime(task.date, "HH:MM")),
      task,
      hour: index === 0 ? group.time : undefined,
    })),
  );
  if (isCurrentDay && rows.length) rows.push({ at: nowAt - 0.5, now: true });
  rows.sort((a, b) => a.at - b.at);
  const live = (row: { at: number; task: TaskProps }) =>
    isCurrentDay && row.at <= nowAt && nowAt < row.at + durationMinutes(row.task.duration);
  const count = dayTasks.length;
  const sub =
    isTomorrow(day) && !calendar ? weekdayDate(day, "EEEE, d MMM") : count > 0 && itemCount(count);

  const listVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.06 } },
  };
  const rowVariants: Variants = {
    hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0 : duration.slow, ease: ease.out },
    },
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
          <h2 className="text-title-3 font-semibold">
            {calendar ? weekdayDate(day, "EEEE, d") : dayLabel(day, now, weekStart)}
          </h2>
          {sub && <span className="text-footnote text-ink-secondary">{sub}</span>}
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
            {rows.map((row) =>
              "task" in row ? (
                <motion.li key={row.task.id} variants={rowVariants}>
                  <DayTaskRow
                    task={row.task}
                    day={day}
                    hour={row.hour}
                    live={live(row)}
                    sheetEditing={sheetEditing}
                  />
                </motion.li>
              ) : (
                <li key="now">
                  <NowLine time={clockAt(now, hour12)} />
                </li>
              ),
            )}
          </motion.ul>
        )}
      </section>
    </ScheduleDrop>
  );
}
