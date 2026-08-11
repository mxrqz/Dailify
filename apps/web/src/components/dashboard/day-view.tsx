import { isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Fragment } from "react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DayTaskRow } from "@/components/dashboard/day-task-row";
import NewTask from "@/components/new-task";
import { TaskCard } from "@/components/task-card";
import {
  getTasksForDay,
  groupTasksByTime,
  nowLineIndex,
  type TimeGroup,
} from "@/functions/functions";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";

const EXPO = [0.16, 1, 0.3, 1] as const; // ease-out-expo, espelha o token do global.css
const SKELETON_ROWS = 3;

/** Linha do "agora": rótulo mono no gutter + régua crimson com glow. Só existe no dia de hoje. */
function NowLine(): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-0.5" aria-hidden="true">
      <span className="w-12 shrink-0 text-right font-mono text-2xs text-accent-primary">
        {copy.day.now}
      </span>
      <span className="h-px flex-1 bg-accent-primary shadow-[0_0_10px_var(--accent-glow)]" />
    </div>
  );
}

/**
 * Um grupo de horário. O rótulo aparece só no PRIMEIRO cartão do grupo — os seguintes recebem
 * `time: ""` e ficam com o gutter vazio. É isso que produz a leitura de coluna do tempo; repetir
 * "08:30" três vezes seria ruído.
 */
function TimeGroupRows({
  group,
  day,
  variants,
}: {
  group: TimeGroup;
  day: Date;
  variants: Variants;
}): JSX.Element {
  return (
    <>
      {group.tasks.map((task, index) => (
        <motion.li key={task.id} variants={variants}>
          <DayTaskRow task={task} day={day} showTime={index === 0} />
        </motion.li>
      ))}
    </>
  );
}

/**
 * A view do dia — a janela que a landing vende (`landing/mocks/day-app-window.tsx`): chrome com o
 * estado do dia, e uma coluna de tarefas com gutter de horário à esquerda.
 *
 * Estados: carregando (skeletons do próprio TaskCard), vazio, e a lista.
 */
export function DayView(): JSX.Element {
  const { tasks, selectedDay, isLoading } = useDailify();
  const reduce = useReducedMotion();
  const now = useNow(60_000);

  const isCurrentDay = isToday(selectedDay);
  const groups = groupTasksByTime(tasks ? getTasksForDay(tasks, selectedDay) : []);
  const lineAt = isCurrentDay ? nowLineIndex(groups, now) : -1;

  const listVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.06 } },
  };
  const rowVariants: Variants = {
    hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 },
    visible: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.35, ease: EXPO } },
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-surface-line bg-surface-card shadow-panel">
      <header className="flex items-center justify-between border-b border-surface-line px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "size-2 rounded-full",
              isCurrentDay
                ? "bg-accent-primary shadow-[0_0_8px_var(--accent-glow)]"
                : "bg-muted-foreground",
            )}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-foreground">
            {isCurrentDay ? copy.day.today : format(selectedDay, "EEEE", { locale: ptBR })}
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {format(selectedDay, "EEE · d MMM", { locale: ptBR })}
        </span>
      </header>

      <div className="scrollbar-floating min-h-0 flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <ul className="flex flex-col gap-3">
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <li key={i}>
                <TaskCard loading time="" title="" duration="" tags={["", ""]} />
              </li>
            ))}
          </ul>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
              {copy.day.emptyTitle}
            </p>
            <p className="max-w-xs text-sm text-content-secondary">{copy.day.emptyHint}</p>
            <NewTask className="mt-2 h-10 rounded-full bg-accent-primary px-5 text-primary-foreground hover:bg-accent-hover" />
          </div>
        ) : (
          <motion.ul
            className="flex flex-col gap-3"
            variants={listVariants}
            initial={reduce ? "visible" : "hidden"}
            animate="visible"
          >
            {groups.map((group, index) => (
              <Fragment key={group.time}>
                {index === lineAt && <NowLine />}
                <TimeGroupRows group={group} day={selectedDay} variants={rowVariants} />
              </Fragment>
            ))}
            {lineAt === groups.length && <NowLine />}
          </motion.ul>
        )}
      </div>
    </section>
  );
}
