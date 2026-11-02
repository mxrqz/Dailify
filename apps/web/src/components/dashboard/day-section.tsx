import { duration, ease } from "@/consts/motion";
import { format, isSameWeek, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion, type Variants } from "motion/react";

import { useDailify } from "@/components/dailifyContext";
import { AnytimeBlock } from "@/components/dashboard/anytime-block";
import { copy } from "@/components/dashboard/copy";
import { DayTaskRow } from "@/components/dashboard/day-task-row";
import { TaskCard } from "@/components/task-card";
import {
  getTasksForDay,
  getTime,
  groupTasksByHour,
  minutesUntil,
  nextGroupIndex,
  type TimeGroup,
} from "@/functions/functions";
import { useNow } from "@/hooks/useNow";
import type { TaskProps } from "@/types/types";
import { cn } from "@/lib/utils";

const SKELETON_ROWS = 3;

/** Id da seção de um dia — a `DayList` usa isto pra rolar até ele. */
export const dayAnchorId = (day: Date) => `day-${format(day, "yyyy-MM-dd")}`;

/**
 * Uma hora cheia. O rótulo ("16:00") aparece só acima do primeiro cartão da hora; o horário exato
 * de cada tarefa vai no chip dentro do cartão.
 */
function TimeGroupRows({
  group,
  day,
  variants,
  isPast,
  countdownFor,
}: {
  group: TimeGroup;
  day: Date;
  variants: Variants;
  isPast: (task: TaskProps) => boolean;
  countdownFor: (task: TaskProps) => string | undefined;
}): JSX.Element {
  return (
    <>
      {group.tasks.map((task, index) => (
        <motion.li key={task.id} variants={variants}>
          {/* O recuo do passado mora AQUI, não no <li>: a variante `visible` anima opacity e o
              style inline do framer venceria a classe. Volta inteiro no hover — segue editável. */}
          <div className={cn(isPast(task) && "opacity-60 transition-opacity hover:opacity-100")}>
            <DayTaskRow
              task={task}
              day={day}
              hour={index === 0 ? group.time : undefined}
              countdown={countdownFor(task)}
            />
          </div>
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

/** Quanto falta pra próxima, no mono do gutter. Acima de uma hora a precisão em minutos não ajuda. */
function countdownLabel(minutes: number): string {
  if (minutes <= 0) return copy.day.startingNow;
  if (minutes < 60) return copy.day.inMinutes.replace("{n}", String(minutes));
  return copy.day.inHours.replace("{n}", String(Math.round(minutes / 60)));
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
  const groups = groupTasksByHour(dayTasks);
  // Passado e contagem são por tarefa, não por hora: 16:00 pode já ter passado e 16:45 não.
  const ordered = groups.flatMap((group) => group.tasks);
  const times = ordered.map((task) => ({ time: getTime(task.date, "HH:MM") }));
  // -1 = nada à frente: hoje já acabou, e aí tudo que está na tela é passado.
  const nextAt = isCurrentDay ? nextGroupIndex(times, now) : -1;
  const next = ordered[nextAt];
  const isPast = (task: TaskProps) =>
    isCurrentDay && (nextAt === -1 || ordered.indexOf(task) < nextAt);
  const countdownFor = (task: TaskProps) =>
    task === next ? countdownLabel(minutesUntil(times[nextAt].time, now)) : undefined;

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
    <section id={dayAnchorId(day)} className="flex scroll-mt-14 flex-col">
      <header className="flex items-center gap-5 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "size-2 rounded-full",
              isCurrentDay ? "bg-accent-primary" : "bg-muted-foreground",
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
          {/* Dia sem tarefa já tem o bloco A qualquer hora ou "Nada neste dia" no corpo. */}
          {dayTasks.length > 0 && taskCountLabel(dayTasks.length)}
        </span>
      </header>

      {isCurrentDay && <AnytimeBlock />}

      {!isCurrentDay && dayTasks.length === 0 && (
        <p className="text-sm text-content-secondary">{copy.day.emptyDay}</p>
      )}

      {groups.length > 0 && (
        <motion.ul
          className="flex flex-col gap-3"
          variants={listVariants}
          initial={reduce ? "visible" : "hidden"}
          animate="visible"
        >
          {groups.map((group) => (
            <TimeGroupRows
              key={group.time}
              group={group}
              day={day}
              variants={rowVariants}
              isPast={isPast}
              countdownFor={countdownFor}
            />
          ))}
        </motion.ul>
      )}
    </section>
  );
}
