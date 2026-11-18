import { useState, type ReactNode } from "react";
import { BellIcon, RepeatIcon, VideoIcon } from "lucide-react";
import { durationMinutes, isCalendarEventLink, videoLink } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { SwipeActions } from "@/components/dashboard/swipe-actions";
import { RecurrenceScopeDialog } from "@/components/dashboard/recurrence-scope-dialog";
import {
  DateTimePopover,
  DurationMenu,
  LinksPopover,
  PriorityMenu,
  RepeatMenu,
} from "@/components/dashboard/task-meta-menus";
import { AddToCalendar } from "@/components/add-to-calendar";
import { ClockCheck } from "@/components/clock-check";
import { CheckCircle, TaskRow } from "@/components/kit/task-row";
import { CalendarBadge } from "@/components/logos";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import { TaskCard } from "@/components/task-card";
import { useDailify } from "@/components/dailifyContext";
import { clockAt } from "@/functions/date-label";
import { fill, formatClock, taskToCardData } from "@/functions/functions";
import { repeatLabel } from "@/functions/repeat-label";
import { useTaskActions } from "@/hooks/useTaskActions";
import type { Task } from "@dailify/shared";
import { zoned } from "@/functions/zone";

/** 15 → "15 min", 60 → "1h", 90 → "1h30": a duração embaixo do horário. */
export function durationText(minutes: number): string {
  if (minutes < 60) return fill(copy.day.minutes, { n: minutes });
  const m = minutes % 60;
  return fill(copy.day.hours, {
    h: Math.floor(minutes / 60),
    m: m ? String(m).padStart(2, "0") : "",
  });
}

/** A linha do agora entre as tarefas de hoje: hora em `brand-text`, fio com a bolinha. */
export function NowLine({ time }: { time: string }): JSX.Element {
  return (
    <div
      role="separator"
      aria-label={fill(copy.day.nowAt, { time })}
      className="flex h-3 items-center gap-2 pr-1.5 pl-3"
    >
      <b className="w-11 flex-none text-right text-xs font-semibold text-brand-text tabular-nums">
        {time}
      </b>
      <i className="relative ml-1 h-0.5 flex-1 rounded-full bg-brand before:absolute before:-top-0.75 before:-left-1 before:size-2 before:rounded-full before:bg-brand" />
    </div>
  );
}

/** "Agenda · Seg, Qua · Lembrete 30 min antes · Meet" com os ícones neutros na frente. */
function taskMeta(task: Task, live: boolean, hour12: boolean): ReactNode {
  const calendar = task.links?.some(isCalendarEventLink);
  const repeat = repeatLabel(task.repeat, task.repeatEvery);
  const meet = videoLink(task.links);
  const before =
    task.alert === undefined ? undefined : Math.round((task.date - task.alert) / 60_000);
  const end = task.date + durationMinutes(task.duration) * 60_000;
  const text = [
    live && fill(copy.day.until, { time: clockAt(end, hour12) }),
    calendar && copy.calendar.name,
    repeat,
    before !== undefined &&
      (before <= 0
        ? copy.day.reminderOnTime
        : fill(copy.day.reminderBefore, { n: durationText(before) })),
    meet && copy.day.meet,
  ].filter(Boolean);
  if (!text.length) return undefined;
  return (
    <>
      {calendar && <CalendarBadge />}
      {repeat && <RepeatIcon aria-hidden="true" />}
      {before !== undefined && <BellIcon aria-hidden="true" />}
      {meet && <VideoIcon aria-hidden="true" />}
      <span className="truncate">{text.join(" · ")}</span>
    </>
  );
}

/**
 * Uma linha da coluna do dia: o cartão + suas ações + a folha de edição, que no toque abre por
 * baixo — concluir e excluir moram no rodapé dela, sem modo leitura intermediário.
 *
 * O clique no cartão abre a folha por ESTADO (`open`), não por `SheetTrigger` — o TaskCard já tem
 * seu próprio botão-overlay, e envolvê-lo num trigger `asChild` aninharia botão dentro de botão.
 * `selected={open}` é o que dá ao cartão aberto a borda crimson: é o quinto papel do acento
 * ("tarefa aberta") previsto no spec, que até aqui não tinha quem o usasse.
 */
export function DayTaskRow({
  task,
  day,
  hour,
  live = false,
  sheetEditing,
}: {
  task: Task;
  day: Date;
  /** `SHEET_EDITING`, lido uma vez pela seção e não um matchMedia por linha. */
  sheetEditing: boolean;
  /** "16:00" acima do primeiro cartão da hora (desktop); os seguintes não repetem. */
  hour?: string;
  /** Em curso agora: a linha acende e ganha o "Agora". */
  live?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const { hour12 } = useDailify();
  const data = taskToCardData(task, day);
  const { onPatch, onRename, onComplete, onUncomplete, onDelete, deleteDialog } = useTaskActions(
    task,
    day,
  );

  const toggle = () => void (data.completed ? onUncomplete() : onComplete());
  // Remarcar uma recorrente espera a escolha entre esta ocorrência e a série.
  const [moveTo, setMoveTo] = useState<Date | null>(null);
  // Os diálogos montam no primeiro uso e ficam (animação de saída): fechados, custavam por linha.
  const [dialogs, setDialogs] = useState(false);
  const askScope = (to: Date) => {
    setDialogs(true);
    setMoveTo(to);
  };
  const remove = () => {
    setDialogs(true);
    void onDelete();
  };
  const move = (to: Date, occurrence?: number) => {
    const shift = to.getTime() - task.date;
    // O alerta anda junto: remarcar não pode deixar o lembrete no horário antigo.
    void onPatch(
      { date: to.getTime(), ...(task.alert === undefined ? {} : { alert: task.alert + shift }) },
      occurrence,
    );
  };

  // Um caminho de edição por vez: no toque o cartão é só leitura e tudo acontece na folha.
  const edit = sheetEditing
    ? undefined
    : {
        time: (chip: JSX.Element) => (
          <DateTimePopover
            value={zoned(task.date)}
            onChange={(to) => (task.repeat === "Off" ? move(to) : askScope(to))}
          >
            {chip}
          </DateTimePopover>
        ),
        link: (chip: JSX.Element) => (
          <LinksPopover value={task.links ?? []} onChange={(links) => void onPatch({ links })}>
            {chip}
          </LinksPopover>
        ),
        repeat: (chip: JSX.Element) => (
          <RepeatMenu
            value={task.repeat}
            every={task.repeatEvery}
            date={task.date}
            onChange={(repeat, every) =>
              void onPatch({ repeat, repeatEvery: every > 1 ? every : null })
            }
          >
            {chip}
          </RepeatMenu>
        ),
        priority: (chip: JSX.Element) => (
          <PriorityMenu value={task.priority} onChange={(priority) => void onPatch({ priority })}>
            {chip}
          </PriorityMenu>
        ),
        duration: (chip: JSX.Element) => (
          <DurationMenu value={task.duration} onChange={(duration) => void onPatch({ duration })}>
            {chip}
          </DurationMenu>
        ),
        complete: { done: data.completed, toggle },
        remove,
        calendar: <AddToCalendar task={task} variant="toolbar" />,
      };

  const time = hour ? formatClock(hour, hour12) : "";
  // ponytail: o desktop segue no TaskCard (edição nos chips, por hover); portar pra TaskRow pede
  // levar os popovers de horário/duração/repetição pra dentro da meta.
  const card = sheetEditing ? (
    <TaskRow
      time={formatClock(data.time, hour12)}
      duration={task.duration ? durationText(durationMinutes(task.duration)) : undefined}
      title={task.title}
      meta={taskMeta(task, live && !data.completed, hour12)}
      done={data.completed}
      live={live && !data.completed}
      onOpen={() => setOpen(true)}
      trailing={<CheckCircle checked={data.completed} onCheckedChange={toggle} />}
    />
  ) : (
    <TaskCard
      {...data}
      time={time}
      at={formatClock(data.time, hour12)}
      selected={open}
      check={
        <ClockCheck
          time={data.time}
          checked={data.completed}
          onCheckedChange={(next) => void (next ? onComplete() : onUncomplete())}
          label={data.completed ? copy.task.uncomplete : copy.task.complete}
        />
      }
      onTitleChange={onRename}
      edit={edit}
    />
  );

  return (
    <EditTask open={open} onOpenChange={setOpen}>
      {sheetEditing ? (
        <SwipeActions onComplete={toggle} onDelete={remove}>
          {card}
        </SwipeActions>
      ) : (
        card
      )}

      <EditTaskContent task={task} day={day} open={open} onClose={() => setOpen(false)} />
      {dialogs && (
        <>
          {deleteDialog}
          <RecurrenceScopeDialog
            open={moveTo !== null}
            onOpenChange={(next) => !next && setMoveTo(null)}
            description={copy.form.scopeDescription}
            onOccurrence={() => {
              if (moveTo) move(moveTo, task.date);
              setMoveTo(null);
            }}
            onSeries={() => {
              if (moveTo) move(moveTo);
              setMoveTo(null);
            }}
          />
        </>
      )}
    </EditTask>
  );
}
