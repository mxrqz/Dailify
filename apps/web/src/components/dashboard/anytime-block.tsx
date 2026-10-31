import { useState, type FormEvent } from "react";
import { Bell, Plus, RepeatIcon } from "lucide-react";
import { PERIOD_ROLLOVER_HOUR, type Task } from "@dailify/shared";

import { ClockCheck } from "@/components/clock-check";
import { useDailify } from "@/components/dailifyContext";
import { CheckHistory, periodKind } from "@/components/dashboard/check-history";
import { copy } from "@/components/dashboard/copy";
import { SHEET_EDITING } from "@/components/dashboard/day-task-row";
import { SwipeActions } from "@/components/dashboard/swipe-actions";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import { parseTaskText } from "@/functions/parse-task";
import { repeatLabel } from "@/functions/repeat-label";
import { pendingUndated, splitUndated } from "@/functions/undated";
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
      <Bell className="size-3" role="img" aria-label={copy.undated.reminder} />
      {weekday(date.getDay())} {hhmm(date)}
    </span>
  );
}

function AnytimeRow({ task, swipe }: { task: Task; swipe: boolean }): JSX.Element {
  const { weekStart } = useDailify();
  const { done, toggle, remove } = useUndatedActions(task);
  const [open, setOpen] = useState(false);
  const recurring = task.repeat !== "Off";

  const sub =
    task.repeat !== "Off" && done ? (
      <span className="text-success">{copy.undated[`done${periodKind(task.repeat)}`]}</span>
    ) : task.alert ? (
      <ReminderChip at={task.alert} />
    ) : (
      recurring && (
        <span className="inline-flex items-center gap-1 text-meta-repeat">
          <RepeatIcon className="size-3" aria-hidden />
          {repeatLabel(task.repeat)}
        </span>
      )
    );

  const row = (
    <div className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-hover">
      <ClockCheck
        checked={done}
        onCheckedChange={() => void toggle()}
        label={done ? copy.task.uncomplete : copy.task.complete}
      />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "block truncate text-sm",
            done ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {task.title}
        </span>
        {(sub || recurring) && (
          <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {sub}
            {recurring && <CheckHistory task={task} weekStart={weekStart} periods={8} />}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <EditTask open={open} onOpenChange={setOpen}>
      {swipe ? (
        <SwipeActions onComplete={() => void toggle()} onDelete={() => void remove()}>
          {row}
        </SwipeActions>
      ) : (
        row
      )}
      <EditTaskContent
        task={task}
        day={new Date(task.date)}
        open={open}
        onClose={() => setOpen(false)}
      />
    </EditTask>
  );
}

/** Última linha do bloco: Enter anota sem data, sem abrir a folha de criação. */
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
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors focus-within:bg-surface-hover hover:bg-surface-hover"
    >
      <Plus className="size-5 shrink-0 p-0.5 text-muted-foreground" aria-hidden />
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

const pendingLabel = (n: number): string =>
  n === 1 ? copy.undated.onePending : copy.undated.manyPending.replace("{n}", String(n));

function SectionHeader({ title, hint }: { title: string; hint?: string }): JSX.Element {
  return (
    <div className="mx-2.5 mt-1.5 mb-1 flex justify-between text-xs">
      <h4 className="text-content-secondary">{title}</h4>
      {hint && <span className="text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Topo de hoje: recorrentes (marcadas por período), afazeres sem data e o campo de anotar. */
export function AnytimeBlock(): JSX.Element {
  const { undatedTasks, weekStart } = useDailify();
  const swipe = useMediaQuery(SHEET_EDITING);
  const { recurring, todo } = splitUndated(undatedTasks ?? []);

  const pending = pendingUndated(undatedTasks ?? [], Date.now(), weekStart);
  const hasWeekly = recurring.some((t) => typeof t.repeat === "object");
  const rollover = copy.undated.rollover
    .replace("{day}", weekday(weekStart))
    .replace("{hour}", `${String(PERIOD_ROLLOVER_HOUR).padStart(2, "0")}:00`);

  return (
    <section
      aria-label={copy.undated.title}
      aria-busy={undatedTasks === undefined}
      className="mb-3 flex flex-col rounded-field border border-dashed border-surface-line p-1"
    >
      <div className="flex items-baseline gap-2 px-2.5 py-1.5 font-mono text-2xs uppercase tracking-wider">
        <h3 className="text-content-secondary">{copy.undated.title}</h3>
        {undatedTasks && <span className="text-muted-foreground">{pendingLabel(pending)}</span>}
      </div>

      {recurring.length > 0 && (
        <>
          <SectionHeader title={copy.undated.recurring} hint={hasWeekly ? rollover : undefined} />
          {recurring.map((task) => (
            <AnytimeRow key={task.id} task={task} swipe={swipe} />
          ))}
        </>
      )}

      {recurring.length > 0 && todo.length > 0 && (
        <hr className="mx-2.5 my-2 border-dashed border-surface-line" />
      )}

      {todo.length > 0 && (
        <>
          <SectionHeader title={copy.undated.todo} />
          {todo.map((task) => (
            <AnytimeRow key={task.id} task={task} swipe={swipe} />
          ))}
        </>
      )}

      <CaptureField />
    </section>
  );
}
