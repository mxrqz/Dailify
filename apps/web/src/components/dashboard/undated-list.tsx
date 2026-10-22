import { useState, type FormEvent } from "react";
import { Bell, Check, Plus } from "lucide-react";
import { doneThisPeriod, PERIOD_ROLLOVER_HOUR, type Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { CheckHistory, periodKind } from "@/components/dashboard/check-history";
import { copy } from "@/components/dashboard/copy";
import { SHEET_EDITING } from "@/components/dashboard/day-task-row";
import { SwipeActions } from "@/components/dashboard/swipe-actions";
import { parseTaskText } from "@/functions/parse-task";
import { repeatLabel } from "@/functions/repeat-label";
import { browserTimeZone, splitUndated } from "@/functions/undated";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUndatedActions } from "@/hooks/useUndatedActions";
import { cn } from "@/lib/utils";

const weekday = (day: number) => copy.form.repeatDays[day].toLowerCase();
const hhmm = (date: Date) =>
  date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "🔔 qui 09:00" — crimson é a cor do lembrete. */
function ReminderChip({ at }: { at: number }): JSX.Element {
  const date = new Date(at);
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-accent-line bg-accent-subtle px-1.5 text-accent-primary">
      <Bell className="size-3" aria-label={copy.undated.reminder} />
      {weekday(date.getDay())} {hhmm(date)}
    </span>
  );
}

function UndatedRow({ task, swipe }: { task: Task; swipe: boolean }): JSX.Element {
  const { weekStart } = useDailify();
  const { done, toggle, remove } = useUndatedActions(task);
  const recurring = task.repeat !== "Off";

  const sub =
    task.repeat !== "Off" && done ? (
      <span className="text-success">{copy.undated[`done${periodKind(task.repeat)}`]}</span>
    ) : task.alert ? (
      <ReminderChip at={task.alert} />
    ) : (
      recurring && <span>{repeatLabel(task.repeat)}</span>
    );

  const row = (
    <div className="-mx-2.5 flex items-start gap-2.5 rounded-xl bg-surface-card px-2.5 py-2 transition-colors hover:bg-surface-hover">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? copy.task.uncomplete : copy.task.complete}
        onClick={() => void toggle()}
        className={cn(
          "mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-md border-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          !done && "border-highlight",
          done && (recurring ? "border-success bg-success" : "border-foreground bg-foreground"),
        )}
      >
        <Check
          aria-hidden
          strokeWidth={3}
          className={cn(
            "size-3 text-surface-page transition-[opacity,transform] duration-200 motion-reduce:transition-none",
            done ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        />
      </button>

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm",
            done ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {task.title}
        </span>
        {(sub || recurring) && (
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {sub}
            {recurring && <CheckHistory task={task} weekStart={weekStart} periods={8} />}
          </div>
        )}
      </div>
    </div>
  );

  if (!swipe) return row;
  return (
    <SwipeActions onComplete={() => void toggle()} onDelete={() => void remove()}>
      {row}
    </SwipeActions>
  );
}

/** Campo do topo: Enter anota em Sem data sem abrir a folha de criação. */
function CaptureField(): JSX.Element {
  const { create, submitting } = useCreateTask();
  const [text, setText] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || submitting) return;
    if (await create(parseTaskText(value, new Date()), { undatedOnly: true })) setText("");
  };

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="flex items-center gap-2 rounded-field border border-surface-line bg-surface-page px-3 py-2"
    >
      <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={copy.undated.capture}
        aria-label={copy.undated.capture}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }): JSX.Element {
  return (
    <div className="mx-0.5 mt-1.5 mb-2 flex justify-between text-xs">
      <h3 className="text-content-secondary">{title}</h3>
      {hint && <span className="text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** A lista Sem data: recorrentes (marcadas por período) no topo, afazeres embaixo. */
export function UndatedList({ className }: { className?: string }): JSX.Element {
  const { undatedTasks, weekStart } = useDailify();
  const swipe = useMediaQuery(SHEET_EDITING);
  const { recurring, todo } = splitUndated(undatedTasks ?? []);

  const now = Date.now();
  const tz = browserTimeZone();
  const pending =
    recurring.filter((t) => !doneThisPeriod(t, now, weekStart, tz)).length + todo.length;
  const hasWeekly = recurring.some((t) => typeof t.repeat === "object");
  const rollover = copy.undated.rollover
    .replace("{day}", weekday(weekStart))
    .replace("{hour}", `${String(PERIOD_ROLLOVER_HOUR).padStart(2, "0")}:00`);

  return (
    <section
      aria-label={copy.undated.title}
      aria-busy={undatedTasks === undefined}
      className={cn("flex flex-col", className)}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{copy.undated.title}</h2>
        {undatedTasks && (
          <span className="text-xs text-muted-foreground">
            {pending === 1
              ? copy.undated.onePending
              : copy.undated.manyPending.replace("{n}", String(pending))}
          </span>
        )}
      </div>

      <CaptureField />

      <div className="mt-4 flex flex-col">
        {recurring.length > 0 && (
          <>
            <SectionHeader title={copy.undated.recurring} hint={hasWeekly ? rollover : undefined} />
            {recurring.map((task) => (
              <UndatedRow key={task.id} task={task} swipe={swipe} />
            ))}
          </>
        )}

        {recurring.length > 0 && todo.length > 0 && <hr className="my-3 border-surface-line" />}

        {todo.length > 0 && (
          <>
            <SectionHeader title={copy.undated.todo} />
            {todo.map((task) => (
              <UndatedRow key={task.id} task={task} swipe={swipe} />
            ))}
          </>
        )}

        {undatedTasks && !recurring.length && !todo.length && (
          <p className="mt-2 text-sm text-muted-foreground">{copy.undated.empty}</p>
        )}
      </div>
    </section>
  );
}
