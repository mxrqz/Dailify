import { format, isSameWeek, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Fragment } from "react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DayTaskRow } from "@/components/dashboard/day-task-row";
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

/** Id da seção de um dia — a `WeekStrip` usa isto pra rolar até ele. */
export const dayAnchorId = (day: Date) => `day-${format(day, "yyyy-MM-dd")}`;

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

/**
 * Hoje e amanhã têm nome próprio; o resto da semana corrente vira o dia da semana ("Sexta"), e
 * daí em diante a data por extenso — "sexta" só situa alguém dentro da semana em que ele está.
 */
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function dayLabel(day: Date, now: Date): string {
  if (isToday(day)) return copy.day.today;
  if (isTomorrow(day)) return copy.day.tomorrow;
  // Mês abreviado, não por extenso: "16 · AGO" atravessa idiomas com o locale do date-fns.
  if (!isSameWeek(day, now)) return format(day, "d · MMM", { locale: ptBR }).toUpperCase();
  return capitalize(format(day, "EEEE", { locale: ptBR }).replace("-feira", ""));
}

function taskCountLabel(count: number): string {
  if (count === 0) return copy.day.noTasks;
  if (count === 1) return copy.day.oneTask;
  return copy.day.manyTasks.replace("{n}", String(count));
}

/**
 * Um dia: cabeçalho (marcador + rótulo, pontilhada, data em mono) e as tarefas embaixo. É o bloco
 * que a `DayList` empilha — o scroll é da página, não daqui.
 */
export function DaySection({ day }: { day: Date }): JSX.Element {
  const { tasks } = useDailify();
  const reduce = useReducedMotion();
  const now = useNow(60_000);

  const isCurrentDay = isToday(day);
  const dayTasks = tasks ? getTasksForDay(tasks, day) : [];
  const groups = groupTasksByTime(dayTasks);
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
    <section id={dayAnchorId(day)} className="flex scroll-mt-14 flex-col">
      <header className="flex items-center gap-5 py-4">
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
          <span className="text-sm font-medium text-foreground">{dayLabel(day, now)}</span>
        </div>

        <span
          className="h-px flex-1 border-t border-dashed border-surface-line"
          aria-hidden="true"
        />

        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {taskCountLabel(dayTasks.length)}
        </span>
      </header>

      {groups.length > 0 && (
        <motion.ul
          className="flex flex-col gap-3"
          variants={listVariants}
          initial={reduce ? "visible" : "hidden"}
          animate="visible"
        >
          {groups.map((group, index) => (
            <Fragment key={group.time}>
              {index === lineAt && <NowLine />}
              <TimeGroupRows group={group} day={day} variants={rowVariants} />
            </Fragment>
          ))}
          {lineAt === groups.length && <NowLine />}
        </motion.ul>
      )}
    </section>
  );
}
