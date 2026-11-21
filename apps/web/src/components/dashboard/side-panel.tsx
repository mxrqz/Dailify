import { useEffect, type ReactNode } from "react";
import { ArrowUpRightIcon, PlusIcon, XIcon } from "lucide-react";
import type { Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { CheckCircle, TaskRow } from "@/components/kit/task-row";
import { Button } from "@/components/ui/button";
import { clockAt, weekdayDate } from "@/functions/date-label";
import { getCompletionDate, getTasksForDay } from "@/functions/functions";
import { zoned } from "@/functions/zone";
import { closePanel, openPanel, usePanel, type PanelState } from "@/hooks/usePanel";
import { useTaskActions } from "@/hooks/useTaskActions";
import { cn } from "@/lib/utils";

/** The toolbar toggle's `aria-controls`. */
export const SIDE_PANEL_ID = "side-panel";

/**
 * The desktop side panel: glass, header (title, actions, close), a scrolling body and an optional
 * footer. From `xl` it is a column that pushes the agenda; below, it overlays the right edge.
 */
export function SidePanel({
  title,
  actions,
  footer,
  onClose,
  children,
}: {
  title: string;
  /** Icon buttons between the title and the close (`size="icon-sm"`). */
  actions?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}): JSX.Element {
  return (
    <aside
      id={SIDE_PANEL_ID}
      aria-label={title}
      className={cn(
        "glass fixed inset-y-0 right-0 z-float flex h-dvh w-side shrink-0 flex-col border-l border-separator shadow-raised",
        "xl:sticky xl:top-0 xl:z-auto xl:shadow-none",
        "transition-[translate,opacity] duration-base ease-out starting:translate-x-4 starting:opacity-0 motion-reduce:transition-none",
      )}
    >
      <header className="flex h-13 shrink-0 items-center gap-1.5 pr-2.5 pl-5">
        <h2 className="min-w-0 flex-1 truncate text-subhead font-semibold">{title}</h2>
        {actions}
        <Button variant="ghost" size="icon-sm" aria-label={copy.panel.close} onClick={onClose}>
          <XIcon aria-hidden="true" />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-1 pb-6">
        {children}
      </div>
      {footer && (
        <footer className="flex shrink-0 items-center gap-2 border-t border-separator px-5 pt-3 pb-5">
          {footer}
        </footer>
      )}
    </aside>
  );
}

const titleOf = (panel: PanelState): string =>
  panel.kind === "task"
    ? copy.panel.task
    : panel.kind === "mew"
      ? copy.panel.mew
      : weekdayDate(zoned(panel.day), "EEEE, d 'de' MMMM");

/** A compact agenda row in the day panel: opens the task, the circle completes this occurrence. */
function DayPanelRow({ task, day }: { task: Task; day: Date }): JSX.Element {
  const { hour12 } = useDailify();
  const { onComplete, onUncomplete } = useTaskActions(task, day);
  const done = getCompletionDate(task, day) === true;
  return (
    <TaskRow
      time={clockAt(task.date, hour12)}
      title={task.title}
      done={done}
      onOpen={() => openPanel({ kind: "task", id: task.id, day: day.getTime() })}
      trailing={
        <CheckCircle
          checked={done}
          onCheckedChange={() => void (done ? onUncomplete() : onComplete())}
        />
      }
      className="min-h-12"
    />
  );
}

/** The calendar day's tasks in clock order, or the empty line. */
function DayPanelBody({ day }: { day: Date }): JSX.Element {
  const { tasks } = useDailify();
  const list = tasks ? [...getTasksForDay(tasks, day)].sort((a, b) => a.date - b.date) : [];
  if (!list.length) {
    return <p className="pt-2 text-subhead text-ink-secondary">{copy.day.emptyDay}</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {list.map((task) => (
        <li key={`${task.id}-${task.date}`}>
          <DayPanelRow task={task} day={day} />
        </li>
      ))}
    </ul>
  );
}

/** The panel wired to `usePanel`: Esc closes it, and each `kind` picks its content. */
export function PanelHost({
  onCreateOn,
  onOpenDay,
}: {
  /** "Nova tarefa nesse dia": the composer opened on that day. */
  onCreateOn: (day: Date) => void;
  /** Shows the day in Hoje, leaving the calendar. */
  onOpenDay: (day: Date) => void;
}): JSX.Element | null {
  const panel = usePanel();
  const open = panel !== null;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // A dialog or menu over the panel takes this Esc for itself.
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"]')) return;
      closePanel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!panel) return null;
  if (panel.kind === "day") {
    const day = zoned(panel.day);
    return (
      <SidePanel
        title={titleOf(panel)}
        onClose={closePanel}
        actions={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.panel.openInToday}
            onClick={() => onOpenDay(day)}
          >
            <ArrowUpRightIcon aria-hidden="true" />
          </Button>
        }
        footer={
          <Button variant="secondary" className="w-full" onClick={() => onCreateOn(day)}>
            <PlusIcon aria-hidden="true" />
            {copy.panel.createOnDay}
          </Button>
        }
      >
        <DayPanelBody day={day} />
      </SidePanel>
    );
  }
  // ponytail: the task and Mew kinds render an empty body; their phases fill them here.
  return <SidePanel title={titleOf(panel)} onClose={closePanel} />;
}
