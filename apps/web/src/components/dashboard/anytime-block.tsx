import { useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { Bell, Plus, RepeatIcon } from "lucide-react";
import { DEFAULT_HOUR, PERIOD_ROLLOVER_HOUR, parseTaskText, type Task } from "@dailify/shared";

import { ClockCheck } from "@/components/clock-check";
import { useDailify } from "@/components/dailifyContext";
import { CheckHistory, periodKind } from "@/components/dashboard/check-history";
import { copy } from "@/components/dashboard/copy";
import { SHEET_EDITING } from "@/components/dashboard/day-task-row";
import { TimeWheel } from "@/components/dashboard/date-time-picker";
import { calendarPanel } from "@/components/dashboard/styles";
import { SwipeActions } from "@/components/dashboard/swipe-actions";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { repeatLabel } from "@/functions/repeat-label";
import { pendingUndated, splitUndated } from "@/functions/undated";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUndatedActions } from "@/hooks/useUndatedActions";
import { format, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { zoned } from "@/functions/zone";

const weekday = (day: number) => copy.form.repeatDays[day].toLowerCase();
const hhmm = (date: Date) => format(date, "HH:mm");

/** Só uma linha daqui vira alvo de soltar: arquivo ou texto arrastado de fora não. */
export const DRAG_TYPE = "application/x-mewki-task";
/** Arrastar é do mouse: no toque a linha já desliza (swipe) e segue só com a folha de edição. */
const NO_DRAG = "(max-width: 767px), (pointer: coarse)";

/** "🔔 qui 09:00" — crimson é a cor do lembrete. */
function ReminderChip({ at }: { at: number }): JSX.Element {
  const date = zoned(at);
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-accent-line bg-accent-subtle px-1.5 text-brand-text">
      <Bell className="size-3" role="img" aria-label={copy.undated.reminder} />
      {weekday(date.getDay())} {hhmm(date)}
    </span>
  );
}

function AnytimeRow({
  task,
  swipe,
  drag,
}: {
  task: Task;
  swipe: boolean;
  drag: boolean;
}): JSX.Element {
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
          {repeatLabel(task.repeat, task.repeatEvery)}
        </span>
      )
    );

  const row = (
    <div
      draggable={drag}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-surface-hover"
    >
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
        day={zoned(task.date)}
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
    if (await create(parseTaskText(value, zoned()), { undatedOnly: true })) setText("");
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
  const drag = !useMediaQuery(NO_DRAG);
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
            <AnytimeRow key={task.id} task={task} swipe={swipe} drag={drag} />
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
            <AnytimeRow key={task.id} task={task} swipe={swipe} drag={drag} />
          ))}
        </>
      )}

      <CaptureField />
    </section>
  );
}

/** 09:00 do dia; hoje, com as 09:00 já passadas, a próxima hora cheia. */
function dropTime(day: Date): Date {
  const at = zoned(day);
  const now = zoned();
  const late = isSameDay(at, now) && now.getHours() >= DEFAULT_HOUR;
  at.setHours(late ? Math.min(23, now.getHours() + 1) : DEFAULT_HOUR, 0, 0, 0);
  return at;
}

function SchedulePicker({
  task,
  day,
  label,
  onDone,
}: {
  task: Task;
  day: Date;
  label: string;
  onDone: () => void;
}): JSX.Element {
  const { schedule } = useUndatedActions(task);
  const [at, setAt] = useState(() => dropTime(day));

  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm text-foreground">{task.title}</p>
      </div>
      <TimeWheel value={at} onChange={setAt} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" className="h-9 rounded-sm" onClick={onDone}>
          {copy.form.cancel}
        </Button>
        <Button
          className="h-9 rounded-sm bg-accent-primary text-primary-foreground hover:bg-accent-hover"
          onClick={() => {
            void schedule(at.getTime());
            onDone();
          }}
        >
          {copy.undated.schedule}
        </Button>
      </div>
    </div>
  );
}

/**
 * Um dia da lista ou da faixa como alvo de uma linha da Sem data (desktop). Soltar abre a roda de
 * horário ancorada no dia; só "Agendar" grava — fechar de qualquer outro jeito é cancelar. Quem
 * desenha o destaque é o filho, com `data-drop-over:`. Pelo teclado, a folha de edição faz o mesmo.
 */
export function ScheduleDrop({ day, children }: { day: Date; children: ReactNode }): JSX.Element {
  const { undatedTasks } = useDailify();
  const [over, setOver] = useState(false);
  const [dropped, setDropped] = useState<Task | null>(null);
  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE);
  const label = copy.undated.scheduleTitle.replace(
    "{day}",
    format(day, "EEEEEE · d MMM", { locale: ptBR }),
  );

  return (
    <Popover open={dropped !== null} onOpenChange={(open) => !open && setDropped(null)}>
      <PopoverAnchor
        asChild
        data-drop-over={over || undefined}
        onDragOver={(e) => {
          if (!accepts(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setOver(true);
        }}
        // Passar por cima de um filho também dispara o leave: só sai de fato quem saiu do dia.
        onDragLeave={(e) => {
          const to = e.relatedTarget;
          if (!(to instanceof Node && e.currentTarget.contains(to))) setOver(false);
        }}
        onDrop={(e) => {
          if (!accepts(e)) return;
          e.preventDefault();
          setOver(false);
          const id = e.dataTransfer.getData(DRAG_TYPE);
          setDropped(undatedTasks?.find((t) => t.id === id) ?? null);
        }}
      >
        {children}
      </PopoverAnchor>
      <PopoverContent
        align="start"
        aria-label={label}
        className={cn(calendarPanel, "motion-reduce:animate-none")}
      >
        {dropped && (
          <SchedulePicker task={dropped} day={day} label={label} onDone={() => setDropped(null)} />
        )}
      </PopoverContent>
    </Popover>
  );
}
