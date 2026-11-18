import type { ReactNode } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { isCalendarEventLink, type Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { CheckCircle, TaskRow } from "@/components/kit/task-row";
import { CalendarBadge } from "@/components/logos";
import { Button } from "@/components/ui/button";
import { clockAt } from "@/functions/date-label";
import { fill, getCompletionDate } from "@/functions/functions";
import { fromDateInput, zoned } from "@/functions/zone";
import { cn } from "@/lib/utils";

import type { ChatAction, ConfirmBlock } from "./thread";

const t = copy.mewChat;

/** "hoje", "amanhã" or the weekday ("sexta-feira"), as the Mew says it. */
function dayName(ms: number): string {
  const day = zoned(ms);
  const now = zoned();
  if (isSameDay(day, now)) return t.todayWord;
  if (isSameDay(day, addDays(now, 1))) return t.tomorrowWord;
  return format(day, "EEEE", { locale: ptBR });
}

const dayOf = (task: Task) => (task.undated ? copy.undated.title : dayName(task.date));
/** "sexta-feira · 10:00". */
const whenOf = (task: Task, hour12: boolean) =>
  task.undated ? dayOf(task) : `${dayOf(task)} · ${clockAt(task.date, hour12)}`;

/** A task as the agenda shows it; `meta` replaces the day line. */
export function Row({ task, meta, onOpen }: { task: Task; meta?: ReactNode; onOpen?: () => void }) {
  const { hour12 } = useDailify();
  const calendar = task.links?.some(isCalendarEventLink);
  return (
    <TaskRow
      time={task.undated ? "" : clockAt(task.date, hour12)}
      title={task.title}
      done={getCompletionDate(task, zoned(task.date)) === true}
      meta={
        meta ?? (
          <>
            {calendar && <CalendarBadge />}
            <span className="truncate">
              {[dayOf(task), calendar && copy.calendar.name].filter(Boolean).join(" · ")}
            </span>
          </>
        )
      }
      onOpen={onOpen}
    />
  );
}

export function ConfirmBody({
  block,
  dispatch,
}: {
  block: ConfirmBlock;
  dispatch: (action: ChatAction) => void;
}) {
  const { hour12 } = useDailify();
  const b = t.box;
  const { action, step } = block;
  const picked = block.after.filter((x) => !block.off.includes(x.id));
  const n = action === "delete" || action === "move" ? block.before.length : picked.length;
  // A move's label is its target day ("2026-11-21"); a steps' label, the parent title.
  const day = action === "move" && block.label ? dayName(+fromDateInput(block.label)) : "";
  const values = { n, day, task: block.label ?? "" };

  if (step === "cancelled" || step === "undone")
    return (
      <p className="text-subhead text-ink-secondary">
        {step === "cancelled" ? b.cancelled : b.undone}
      </p>
    );

  if (step === "done") {
    const summary = (action === "delete" ? block.before : block.after)
      .map((x) => x.title)
      .join(", ");
    const doneText = {
      move: b.moved,
      create: b.created,
      steps: b.added,
      event: b.scheduled,
      delete: b.removed,
    }[action];
    return (
      <>
        <div className="flex items-center gap-1.5 text-subhead font-semibold text-brand-text">
          <CheckIcon aria-hidden="true" className="size-4" strokeWidth={2.6} />
          {fill(doneText, values)}
        </div>
        <p className="mt-1.5 truncate border-l-2 border-separator pl-2.5 text-footnote text-ink-secondary">
          {summary}
        </p>
        <div className="mt-2.5 flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => dispatch({ type: "undo", block: block.id })}
          >
            {b.undo}
          </Button>
        </div>
      </>
    );
  }

  const head = {
    move: [b.move, b.moveSource],
    create: [b.create, b.createSource],
    steps: [b.steps, b.stepsSource],
    event: [b.event, b.eventSource],
    delete: [b.remove, b.removeSource],
  }[action];
  const cta = {
    move: b.confirm,
    create: b.createN,
    steps: b.addN,
    event: b.createEvent,
    delete: b.removeN,
  }[action];

  return (
    <>
      <div className="mb-2.5">
        <b className="block text-subhead font-semibold">{fill(head[0], values)}</b>
        <span className="text-footnote text-ink-secondary">{head[1]}</span>
      </div>
      {action === "create" || action === "steps" ? (
        <ul className="flex flex-col divide-y divide-separator rounded-md bg-fill px-3">
          {block.after.map((task) => {
            const on = !block.off.includes(task.id);
            const toggle = () => dispatch({ type: "toggle", block: block.id, task: task.id });
            return (
              <li key={task.id} className="-ml-3 flex items-center">
                <CheckCircle
                  checked={on}
                  onCheckedChange={toggle}
                  label={fill(b.include, { title: task.title })}
                />
                <span className={cn("flex min-w-0 flex-1 flex-col py-2", !on && "opacity-50")}>
                  {action === "create" ? (
                    <input
                      value={task.title}
                      aria-label={b.editTitle}
                      onChange={(event) =>
                        dispatch({
                          type: "edit",
                          block: block.id,
                          task: task.id,
                          title: event.target.value,
                        })
                      }
                      className="min-w-0 bg-transparent text-body font-semibold outline-none"
                    />
                  ) : (
                    <span className="text-subhead font-medium">{task.title}</span>
                  )}
                  {action === "create" && (
                    <span className="text-footnote text-ink-secondary tabular-nums">
                      {whenOf(task, hour12)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {(action === "delete" ? block.before : block.after).map((task) => {
            const was = block.before.find((x) => x.id === task.id);
            return (
              <li key={task.id}>
                <Row
                  task={task}
                  meta={
                    action === "move" && was ? (
                      <>
                        <s className="text-ink-tertiary">{whenOf(was, hour12)}</s>
                        <ArrowRightIcon aria-hidden="true" />
                        <span className="text-ink">{dayOf(task)}</span>
                      </>
                    ) : action === "event" ? (
                      <>
                        <CalendarBadge />
                        <span>{dayOf(task)}</span>
                      </>
                    ) : undefined
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => dispatch({ type: "cancel", block: block.id })}
        >
          {b.cancel}
        </Button>
        <Button
          size="sm"
          disabled={!n}
          onClick={() => dispatch({ type: "confirm", block: block.id })}
        >
          {fill(cta, values)}
        </Button>
      </div>
    </>
  );
}