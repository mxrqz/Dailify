import { duration, ease } from "@/consts/motion";
import { format, isSameWeek, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { matchExternalEvent, type ExternalEvent } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { AnytimeBlock, ScheduleDrop } from "@/components/dashboard/anytime-block";
import { copy } from "@/components/dashboard/copy";
import { DayTaskRow } from "@/components/dashboard/day-task-row";
import { LinkToEvent } from "@/components/add-to-calendar";
import { GoogleCalendarLogo } from "@/components/logos";
import { TaskCard } from "@/components/task-card";
import {
  formatClock,
  getTasksForDay,
  getTime,
  groupTasksByHour,
  minutesUntil,
  nextGroupIndex,
  timeToMinutes,
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
  events,
  variants,
  isPast,
  countdownFor,
}: {
  group: TimeGroup;
  day: Date;
  events: ExternalEvent[];
  variants: Variants;
  isPast: (task: TaskProps) => boolean;
  countdownFor: (task: TaskProps) => string | undefined;
}): JSX.Element {
  return (
    <>
      {group.tasks.map((task, index) => {
        const match = events.length ? matchExternalEvent(task, events) : undefined;
        return (
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
              {match && <LinkToEvent task={task} event={match} />}
            </div>
          </motion.li>
        );
      })}
    </>
  );
}

/** Um evento do Google na agenda: só leitura — sem concluir, editar nem arrastar. */
function ExternalEventRow({ event }: { event: ExternalEvent }): JSX.Element {
  const { hour12 } = useDailify();
  const t = copy.calendar;
  const link = "shrink-0 text-xs underline-offset-2 hover:text-foreground hover:underline";
  return (
    <div
      role="group"
      aria-label={t.event}
      className="flex min-w-0 items-center gap-3 rounded-lg border border-dashed border-surface-line px-3 py-2 text-sm text-content-secondary"
    >
      <GoogleCalendarLogo className="size-4 shrink-0" aria-hidden="true" />
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {event.allDay ? t.allDay : formatClock(getTime(event.start, "HH:MM"), hour12)}
      </span>
      <span className="min-w-0 flex-1 truncate">{event.title || t.untitled}</span>
      {event.meet && (
        <a href={event.meet} target="_blank" rel="noreferrer" className={link}>
          {t.meetLink}
        </a>
      )}
      <a href={event.url} target="_blank" rel="noreferrer" className={link}>
        {t.openInGoogle}
      </a>
    </div>
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
export function DaySection({
  day,
  events = [],
}: {
  day: Date;
  /** Os eventos do Google deste dia (`useExternalEvents`), já sem os da Mewki. */
  events?: ExternalEvent[];
}): JSX.Element {
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
  // Tarefas (por hora) e eventos numa ordem só; dia inteiro no topo.
  const rows = [
    ...groups.map((group) => ({ at: timeToMinutes(group.time), group, event: undefined })),
    ...events.map((event) => {
      const { hours, minutes } = getTime(event.start, "{hours, minutes}");
      return { at: event.allDay ? -1 : hours * 60 + minutes, group: undefined, event };
    }),
  ].sort((a, b) => a.at - b.at);

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
        id={dayAnchorId(day)}
        className="flex scroll-mt-14 flex-col rounded-field outline-offset-4 data-drop-over:outline-2 data-drop-over:outline-dashed data-drop-over:outline-accent-primary"
      >
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

        {!isCurrentDay && dayTasks.length === 0 && events.length === 0 && (
          <p className="text-sm text-content-secondary">{copy.day.emptyDay}</p>
        )}

        {rows.length > 0 && (
          <motion.ul
            className="flex flex-col gap-3"
            variants={listVariants}
            initial={reduce ? "visible" : "hidden"}
            animate="visible"
          >
            {rows.map(({ group, event }) =>
              group ? (
                <TimeGroupRows
                  key={group.time}
                  group={group}
                  day={day}
                  events={events}
                  variants={rowVariants}
                  isPast={isPast}
                  countdownFor={countdownFor}
                />
              ) : (
                <motion.li key={`g-${event.id}`} variants={rowVariants}>
                  <ExternalEventRow event={event} />
                </motion.li>
              ),
            )}
          </motion.ul>
        )}
      </section>
    </ScheduleDrop>
  );
}
