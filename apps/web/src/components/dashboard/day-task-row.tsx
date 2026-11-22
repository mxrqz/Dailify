import { useState, type ReactNode } from "react";
import {
  BellIcon,
  CalendarIcon,
  ClockIcon,
  EllipsisIcon,
  RepeatIcon,
  VideoIcon,
} from "lucide-react";
import { durationMinutes, isCalendarEventLink, videoLink } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { SwipeActions } from "@/components/dashboard/swipe-actions";
import { RecurrenceScopeDialog } from "@/components/dashboard/recurrence-scope-dialog";
import { DateTimePopover, DayPopover } from "@/components/dashboard/task-meta-menus";
import { Chip } from "@/components/kit/chip";
import { CheckCircle, TaskRow } from "@/components/kit/task-row";
import { CalendarBadge } from "@/components/logos";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDailify } from "@/components/dailifyContext";
import { clockAt } from "@/functions/date-label";
import { fill, getCompletionDate } from "@/functions/functions";
import { repeatLabel } from "@/functions/repeat-label";
import { spanOf } from "@/functions/span";
import { reminderBefore } from "@/functions/task-options";
import { isSaving } from "@/hooks/useCreateTask";
import { openPanel, usePanel } from "@/hooks/usePanel";
import { useTaskActions } from "@/hooks/useTaskActions";
import type { Task } from "@dailify/shared";
import { appTimeZone, zoned } from "@/functions/zone";

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
  const before = reminderBefore(task);
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
 * Uma linha da coluna do dia. No toque ela desliza (concluir/excluir) e abre a folha de edição; no
 * desktop abre a tarefa no painel lateral e mostra no hover os atalhos de horário, dia e "mais".
 */
export function DayTaskRow({
  task,
  day,
  live = false,
  sheetEditing,
}: {
  task: Task;
  day: Date;
  /** `MOBILE`, lido uma vez pela seção e não um matchMedia por linha. */
  sheetEditing: boolean;
  /** Em curso agora: a linha acende e ganha o "Agora". */
  live?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const { hour12 } = useDailify();
  const panel = usePanel();
  const completed = getCompletionDate(task, day) === true;
  const { onPatch, onComplete, onUncomplete, onDelete, deleteDialog } = useTaskActions(task, day);

  const toggle = () => void (completed ? onUncomplete() : onComplete());
  // Remarcar uma recorrente espera a escolha entre esta ocorrência e a série.
  const [moveTo, setMoveTo] = useState<Date | null>(null);
  // Os diálogos montam no primeiro uso e ficam (animação de saída): fechados, custavam por linha.
  const [dialogs, setDialogs] = useState(false);
  const remove = () => {
    setDialogs(true);
    void onDelete();
  };
  const move = (to: Date, occurrence?: number) => {
    // O alerta anda junto: remarcar não pode deixar o lembrete no horário antigo.
    const before = reminderBefore(task);
    void onPatch(
      {
        date: to.getTime(),
        ...(before === undefined ? {} : { alert: to.getTime() - before * 60_000 }),
      },
      occurrence,
    );
  };
  const reschedule = (to: Date) => {
    if (task.repeat === "Off") return move(to);
    setDialogs(true);
    setMoveTo(to);
  };

  // Recurring instances share the series id, so the panel tells them apart by occurrence.
  const occurrence = task.repeat === "Off" ? undefined : task.date;
  const openTask = () => openPanel({ kind: "task", id: task.id, day: occurrence });
  const selected =
    !sheetEditing && panel?.kind === "task" && panel.id === task.id && panel.day === occurrence;
  const at = zoned(task.date);
  const title = { title: task.title };

  const span = spanOf(task, +day, appTimeZone());
  const spanLabel = span && fill(copy.day.spanDay, span);

  const actions = sheetEditing ? undefined : (
    <>
      {!span && (
        <DateTimePopover timeOnly value={at} onChange={reschedule}>
          <Chip
            variant="select"
            size="sm"
            icon={<ClockIcon aria-hidden="true" className="text-meta-time" />}
            aria-label={fill(copy.task.editTime, title)}
          >
            {clockAt(task.date, hour12)}
          </Chip>
        </DateTimePopover>
      )}
      <DayPopover
        value={at}
        onChange={(picked) => {
          const to = zoned(picked);
          to.setHours(at.getHours(), at.getMinutes(), 0, 0);
          reschedule(to);
        }}
      >
        <Chip
          variant="select"
          size="sm"
          icon={<CalendarIcon aria-hidden="true" />}
          aria-label={fill(copy.task.editDay, title)}
        />
      </DayPopover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Chip
            variant="select"
            size="sm"
            icon={<EllipsisIcon aria-hidden="true" />}
            aria-label={fill(copy.task.more, title)}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={openTask}>{copy.task.open}</DropdownMenuItem>
          <DropdownMenuItem onSelect={remove} className="text-brand-text focus:text-brand-text">
            {copy.task.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  const row = (
    <TaskRow
      time={
        spanLabel ? (
          <span className="text-right text-xs leading-tight">{spanLabel}</span>
        ) : (
          clockAt(task.date, hour12)
        )
      }
      duration={task.duration && !span ? durationText(durationMinutes(task.duration)) : undefined}
      title={task.title}
      meta={
        isSaving(task) ? (
          <span className="truncate">{copy.task.saving}</span>
        ) : (
          taskMeta(task, live && !completed, hour12)
        )
      }
      done={completed}
      live={live && !completed}
      selected={selected}
      onOpen={sheetEditing ? () => setOpen(true) : openTask}
      actions={actions}
      trailing={<CheckCircle checked={completed} onCheckedChange={toggle} />}
    />
  );

  return (
    <>
      {sheetEditing ? (
        <EditTask open={open} onOpenChange={setOpen}>
          <SwipeActions onComplete={toggle} onDelete={remove}>
            {row}
          </SwipeActions>
          <EditTaskContent task={task} day={day} open={open} onClose={() => setOpen(false)} />
        </EditTask>
      ) : (
        row
      )}
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
    </>
  );
}
