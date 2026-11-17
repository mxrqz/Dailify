import { duration, ease } from "@/consts/motion";
import { format, isSameWeek, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { durationMinutes } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { AnytimeBlock, ScheduleDrop } from "@/components/dashboard/anytime-block";
import { copy } from "@/components/dashboard/copy";
import { DayTaskRow, NowLine, SHEET_EDITING } from "@/components/dashboard/day-task-row";
import { TaskCard } from "@/components/task-card";
import {
  formatClock,
  getTasksForDay,
  getTime,
  groupTasksByHour,
  timeToMinutes,
} from "@/functions/functions";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useNow } from "@/hooks/useNow";
import type { TaskProps } from "@/types/types";

const SKELETON_ROWS = 3;

/** Id da seção de um dia — a `DayList` usa isto pra rolar até ele. */
export const dayAnchorId = (day: Date) => `day-${format(day, "yyyy-MM-dd")}`;

export function TaskSkeletons(): JSX.Element {
  return (
    <ul className="flex flex-col gap-3">
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <li key={i}>
          <TaskCard loading time="" title="" duration="" tags={["", ""]} />
        </li>
      ))}
    </ul>
  );
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
/** "Terça, 17 nov": o date-fns em pt-BR, com maiúscula e sem o "-feira". */
export const weekdayDate = (day: Date, pattern: string) =>
  capitalize(format(day, pattern, { locale: ptBR }).replace("-feira", ""));

/**
 * Hoje é "Agenda" (a página já se chama Hoje), amanhã tem nome próprio, o resto da semana corrente
 * vira o dia da semana e daí em diante o dia com a data: "sexta" só situa dentro da semana.
 */
function dayLabel(day: Date, now: Date): string {
  if (isToday(day)) return copy.day.agenda;
  if (isTomorrow(day)) return copy.day.tomorrow;
  if (!isSameWeek(day, now)) return weekdayDate(day, "EEEE, d MMM");
  return weekdayDate(day, "EEEE");
}

const itemCount = (count: number): string =>
  count === 1 ? copy.day.oneItem : copy.day.manyItems.replace("{n}", String(count));

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
  const { tasks, hour12 } = useDailify();
  const reduce = useReducedMotion();
  const sheetEditing = useMediaQuery(SHEET_EDITING);
  const isCurrentDay = isToday(day);
  // Só hoje tem o fio do agora; os outros dias só mudam (rótulo) na virada do dia.
  const now = useNow(isCurrentDay ? 60_000 : "day");
  const dayTasks = tasks ? getTasksForDay(tasks, day) : [];
  const nowAt = now.getHours() * 60 + now.getMinutes();
  // Tarefas e o fio do agora numa ordem só. O fio fica antes do que começa agora (-0.5): o que já
  // começou fica acima dele.
  const rows: Row[] = [
    ...groupTasksByHour(dayTasks).flatMap((group) =>
      group.tasks.map((task, index) => ({
        at: timeToMinutes(getTime(task.date, "HH:MM")),
        task,
        hour: index === 0 ? group.time : undefined,
      })),
    ),
  ];
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
      <section
        id={calendar ? undefined : dayAnchorId(day)}
        className="flex scroll-mt-16 flex-col gap-2 rounded-lg outline-offset-4 data-drop-over:outline-2 data-drop-over:outline-dashed data-drop-over:outline-brand"
      >
        <header className="flex items-baseline justify-between gap-3 px-1 pb-1">
          <h2 className="text-title-3 font-semibold">
            {calendar ? weekdayDate(day, "EEEE, d") : dayLabel(day, now)}
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
            initial={reduce ? "visible" : "hidden"}
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
                  <NowLine time={formatClock(format(now, "HH:mm"), hour12)} />
                </li>
              ),
            )}
          </motion.ul>
        )}
      </section>
    </ScheduleDrop>
  );
}
