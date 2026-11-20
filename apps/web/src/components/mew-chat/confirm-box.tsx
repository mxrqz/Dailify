import { useId, useState, type ReactNode } from "react";
import { addDays, format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRightIcon, CheckIcon, ChevronLeftIcon, PencilIcon } from "lucide-react";
import { isCalendarEventLink, type Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { FORM_VIEWS, TaskForm, type FormView } from "@/components/dashboard/task-form";
import { CheckCircle, TaskRow } from "@/components/kit/task-row";
import { CalendarBadge } from "@/components/logos";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { clockAt } from "@/functions/date-label";
import { buildEdit } from "@/functions/edit-input";
import { fill, getCompletionDate } from "@/functions/functions";
import { fromDateInput, zoned } from "@/functions/zone";
import { cn } from "@/lib/utils";

import { copy as t } from "./copy";
import type { ChatAction, ConfirmBlock } from "./thread";

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
  // The id outlives the close, so the sheet keeps its draft through the exit animation.
  const [editing, setEditing] = useState<string>();
  const [open, setOpen] = useState(false);
  const [opens, setOpens] = useState(0);
  const draft = block.after.find((x) => x.id === editing);
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
                          task: { ...task, title: event.target.value },
                        })
                      }
                      className="min-w-0 bg-transparent text-body font-semibold outline-none"
                    />
                  ) : (
                    <span className="text-subhead font-medium">{task.title}</span>
                  )}
                  {action === "create" && (
                    <button
                      type="button"
                      aria-label={fill(b.editDraft, {
                        title: task.title,
                        when: whenOf(task, hour12),
                      })}
                      onClick={() => {
                        setEditing(task.id);
                        setOpen(true);
                        setOpens((n) => n + 1);
                      }}
                      className="relative flex items-center gap-1 self-start rounded-xs text-footnote text-ink-secondary tabular-nums hit-target focus-ring"
                    >
                      {whenOf(task, hour12)}
                      <PencilIcon aria-hidden="true" className="size-3" />
                    </button>
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
      {draft && (
        <DraftSheet
          // A reopen starts from the draft, not from a closed sheet's unsaved edits.
          key={opens}
          task={draft}
          open={open}
          onClose={() => setOpen(false)}
          onSave={(task) => dispatch({ type: "edit", block: block.id, task })}
        />
      )}
    </>
  );
}

/**
 * The task sheet's form over a draft: saving only replaces it in the box, the confirm still writes.
 * Rendered inside the chat drawer's React tree, so touching it doesn't dismiss the drawer.
 */
function DraftSheet({
  task,
  open,
  onClose,
  onSave,
}: {
  task: Task;
  open: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const { hour12 } = useDailify();
  const formId = useId();
  const [view, setView] = useState<FormView>("root");
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-sheet w-full max-w-lg">
        <SheetTitle className="sr-only">{copy.form.editTitle}</SheetTitle>
        <SheetDescription className="sr-only">{t.box.editDraftDescription}</SheetDescription>
        {view !== "root" && (
          <SheetHeader className="pb-2">
            <div className="flex h-9 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={copy.form.back}
                onClick={() => setView("root")}
                className="relative -ml-2 size-9 hit-target text-ink-secondary hover:text-ink"
              >
                <ChevronLeftIcon className="size-5" />
              </Button>
              <span className="text-body font-semibold">{FORM_VIEWS[view].title}</span>
            </div>
          </SheetHeader>
        )}
        <TaskForm
          id={formId}
          task={task}
          view={view}
          onView={setView}
          hour12={hour12}
          className="min-h-0 flex-1 scrollbar-floating"
          onSubmit={(values) => {
            onSave(buildEdit(task, values, zoned()).taskData);
            onClose();
          }}
        />
        {view === "root" && (
          <SheetFooter className="pb-4">
            <Button type="submit" form={formId} size="lg">
              {copy.form.save}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
