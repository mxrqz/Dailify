import { useState, type ReactNode } from "react";
import { format } from "date-fns";
import { BellIcon, CheckIcon, RepeatIcon, VideoIcon } from "lucide-react";
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
import { CalendarBadge } from "@/components/logos";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import { TaskCard } from "@/components/task-card";
import { useDailify } from "@/components/dailifyContext";
import { formatClock, taskToCardData } from "@/functions/functions";
import { repeatLabel } from "@/functions/repeat-label";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTaskActions } from "@/hooks/useTaskActions";
import type { TaskProps } from "@/types/types";
import { zoned } from "@/functions/zone";
import { cn } from "@/lib/utils";

/**
 * Sem hover não há como alcançar a toolbar do cartão nem os chips, então é aí — e só aí — que o
 * cartão inteiro vira um alvo que abre a folha, e a edição no cartão é desligada INTEIRA (título
 * incluído): dois caminhos de edição no toque só dariam campo aberto sem querer. Com hover
 * (desktop) é o inverso — edita-se tudo no cartão e um clique no meio dele não faz nada. O
 * `max-width` cobre a janela estreita com mouse, onde a linha de metadados já está apertada demais
 * pra editar em cima dela.
 */
export const SHEET_EDITING = "(hover: none), (max-width: 639px)";

/** 15 → "15 min", 60 → "1h", 90 → "1h30": a duração embaixo do horário. */
export function durationText(minutes: number): string {
  if (minutes < 60) return copy.day.minutes.replace("{n}", String(minutes));
  const m = minutes % 60;
  return copy.day.hours
    .replace("{h}", String(Math.floor(minutes / 60)))
    .replace("{m}", m ? String(m).padStart(2, "0") : "");
}

/** O círculo de concluir: 24px dentro de um alvo de 44, cheio de `brand` quando feito. */
export function CheckCircle({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className="group/check grid size-11 flex-none cursor-pointer place-items-center rounded-full outline-none"
    >
      <span
        className={cn(
          "grid size-6 place-items-center rounded-full border-2 text-on-brand transition-colors duration-base ease-out group-active/check:scale-90 group-focus-visible/check:outline-2 group-focus-visible/check:outline-offset-2 group-focus-visible/check:outline-brand-text",
          checked ? "border-brand bg-brand" : "border-ink-secondary",
        )}
      >
        <CheckIcon
          aria-hidden="true"
          strokeWidth={3}
          className={cn(
            "size-3.5 transition-[opacity,scale] duration-base ease-out",
            checked ? "opacity-100" : "scale-60 opacity-0",
          )}
        />
      </span>
    </button>
  );
}

/**
 * A linha da agenda (props → markup): horário e duração à esquerda, título e meta no meio, e à
 * direita o que vier (o círculo de concluir, a seta do Google). `live` é a tarefa em curso.
 */
export function TaskRow({
  time,
  duration,
  title,
  meta,
  done,
  live,
  muted,
  onOpen,
  trailing,
  className,
  ...props
}: {
  time: ReactNode;
  duration?: string;
  title: string;
  /** Ícones neutros e o texto curto ("Seg, Qua · Meet"). */
  meta?: ReactNode;
  done?: boolean;
  live?: boolean;
  /** Evento de fora: texto apagado, título sem peso. */
  muted?: boolean;
  onOpen?: () => void;
  trailing?: ReactNode;
  className?: string;
  role?: string;
  "aria-label"?: string;
}): JSX.Element {
  const body = (
    <>
      <span
        className={cn(
          "flex w-11 flex-none flex-col items-end text-subhead font-medium tabular-nums",
          live ? "text-brand-text" : done || muted ? "text-ink-secondary" : "text-ink",
        )}
      >
        {time}
        {duration && (
          <small className={cn("text-xs font-normal", !live && "text-ink-secondary")}>
            {duration}
          </small>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pl-1">
        <span
          className={cn(
            "truncate text-body",
            muted ? "font-medium text-ink-secondary" : "font-semibold",
            done && "text-ink-secondary line-through decoration-ink-tertiary",
          )}
        >
          {title}
        </span>
        {(live || meta) && (
          <span className="flex min-w-0 items-center gap-1.5 text-footnote text-ink-secondary tabular-nums [&_svg]:size-3.5 [&_svg]:flex-none">
            {live && (
              <span className="inline-flex h-5 flex-none items-center rounded-full bg-brand px-2 text-xs font-semibold text-on-brand">
                {copy.day.now}
              </span>
            )}
            {meta}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div
      {...props}
      className={cn(
        "flex min-h-16 items-center gap-2 rounded-md py-1.5 pr-1.5 pl-3",
        live ? "bg-brand-soft" : "card",
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch rounded-sm text-left outline-none focus-visible:outline-2 focus-visible:outline-brand-text"
        >
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>
      )}
      {trailing}
    </div>
  );
}

/** A linha do agora entre as tarefas de hoje: hora em `brand-text`, fio com a bolinha. */
export function NowLine({ time }: { time: string }): JSX.Element {
  return (
    <div
      role="separator"
      aria-label={copy.day.nowAt.replace("{time}", time)}
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
function taskMeta(task: TaskProps, live: boolean, hour12: boolean): ReactNode {
  const calendar = task.links?.some(isCalendarEventLink);
  const repeat = repeatLabel(task.repeat, task.repeatEvery);
  const meet = videoLink(task.links);
  const before =
    task.alert === undefined ? undefined : Math.round((task.date - task.alert) / 60_000);
  const end = task.date + durationMinutes(task.duration) * 60_000;
  const text = [
    live && copy.day.until.replace("{time}", formatClock(format(zoned(end), "HH:mm"), hour12)),
    calendar && copy.calendar.name,
    repeat,
    before !== undefined &&
      (before <= 0
        ? copy.day.reminderOnTime
        : copy.day.reminderBefore.replace("{n}", durationText(before))),
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
}: {
  task: TaskProps;
  day: Date;
  /** "16:00" acima do primeiro cartão da hora (desktop); os seguintes não repetem. */
  hour?: string;
  /** Em curso agora: a linha acende e ganha o "Agora". */
  live?: boolean;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const sheetEditing = useMediaQuery(SHEET_EDITING);
  const { hour12 } = useDailify();
  const data = taskToCardData(task, day);
  const { onPatch, onRename, onComplete, onUncomplete, onDelete, deleteDialog } = useTaskActions(
    task,
    day,
  );

  const onOpenChange = (next: boolean) => setOpen(next);
  // Remarcar uma recorrente espera a escolha entre esta ocorrência e a série.
  const [moveTo, setMoveTo] = useState<Date | null>(null);
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
            onChange={(to) => (task.repeat === "Off" ? move(to) : setMoveTo(to))}
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
        complete: {
          done: data.completed,
          toggle: () => void (data.completed ? onUncomplete() : onComplete()),
        },
        remove: () => void onDelete(),
        calendar: <AddToCalendar task={task} variant="toolbar" />,
      };

  const toggle = () => void (data.completed ? onUncomplete() : onComplete());
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
      trailing={
        <CheckCircle
          checked={data.completed}
          onCheckedChange={toggle}
          label={data.completed ? copy.task.uncomplete : copy.task.complete}
        />
      }
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
    <EditTask open={open} onOpenChange={onOpenChange}>
      {sheetEditing ? (
        <SwipeActions onComplete={toggle} onDelete={() => void onDelete()}>
          {card}
        </SwipeActions>
      ) : (
        card
      )}

      <EditTaskContent task={task} day={day} open={open} onClose={() => setOpen(false)} />
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
    </EditTask>
  );
}
