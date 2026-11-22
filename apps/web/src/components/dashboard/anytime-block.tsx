import { useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { Bell, Plus, RepeatIcon } from "lucide-react";
import { DEFAULT_HOUR, parseTaskText, type Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { CheckHistory, periodKind } from "@/components/dashboard/check-history";
import { copy } from "@/components/dashboard/copy";
import { CheckCircle, strike } from "@/components/kit/task-row";
import { TimeWheel } from "@/components/dashboard/date-time-picker";
import { calendarPanel } from "@/components/dashboard/styles";
import { SwipeActions } from "@/components/dashboard/swipe-actions";
import { EditTask, EditTaskContent } from "@/components/edit-task";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { MOBILE, NO_DRAG } from "@/consts/media";
import { countLabel } from "@/functions/count-label";
import { clockAt, dayDot } from "@/functions/date-label";
import { fill } from "@/functions/functions";
import { repeatLabel } from "@/functions/repeat-label";
import { pendingUndated, splitUndated } from "@/functions/undated";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { openPanel, usePanel } from "@/hooks/usePanel";
import { useUndatedActions } from "@/hooks/useUndatedActions";
import { isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { zoned } from "@/functions/zone";

const weekday = (day: number) => copy.form.repeatDays[day].toLowerCase();

/** Só uma linha daqui vira alvo de soltar: arquivo ou texto arrastado de fora não. */
export const DRAG_TYPE = "application/x-mewki-task";

/**
 * Uma linha do card A qualquer hora (props → markup): o círculo à esquerda, título e meta. O
 * separador é só entre linhas (`first` não tem) e começa depois do círculo.
 */
export function AnytimeItem({
  title,
  done,
  meta,
  first,
  selected,
  onToggle,
  onOpen,
  draggable,
  onDragStart,
}: {
  title: string;
  done: boolean;
  meta: ReactNode;
  first?: boolean;
  /** The task open in the desktop side panel. */
  selected?: boolean;
  onToggle: () => void;
  onOpen?: () => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
}): JSX.Element {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn("flex min-h-14 items-center gap-3 pr-4 pl-1.5", selected && "bg-fill-pressed")}
    >
      <CheckCircle checked={done} onCheckedChange={onToggle} />
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected || undefined}
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 self-stretch border-separator py-2.5 text-left outline-none pointer-fine:focus-visible:bg-fill",
          !first && "border-t",
        )}
      >
        <span className={cn("truncate text-body font-semibold", strike(done))}>{title}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-footnote text-ink-secondary tabular-nums [&_svg]:size-3.5 [&_svg]:flex-none">
          {meta}
        </span>
      </button>
    </div>
  );
}

/** O card A qualquer hora (props → markup): título, contagem de pendentes e as linhas. */
export function AnytimeCard({
  pending,
  busy,
  empty,
  children,
}: {
  pending?: number;
  busy?: boolean;
  /** No rows: on mobile the capture field is hidden, so the header closes the card itself. */
  empty?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <section
      aria-label={copy.undated.title}
      aria-busy={busy}
      className="card mb-1 flex flex-col rounded-lg py-1"
    >
      <div
        className={cn(
          "flex items-baseline justify-between px-4 pt-3 pb-1.5",
          empty && "max-md:pb-3",
        )}
      >
        <h3 className="text-subhead font-medium text-ink-secondary">{copy.undated.title}</h3>
        {pending !== undefined && (
          <span className="text-footnote text-ink-secondary">{pendingLabel(pending)}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function AnytimeRow({
  task,
  swipe,
  drag,
  first,
}: {
  task: Task;
  swipe: boolean;
  drag: boolean;
  first: boolean;
}): JSX.Element {
  const { weekStart, hour12 } = useDailify();
  const { done, toggle, remove, deleteDialog } = useUndatedActions(task);
  const [open, setOpen] = useState(false);
  const panel = usePanel();

  const meta =
    task.repeat !== "Off" ? (
      <>
        <RepeatIcon aria-hidden="true" />
        {done
          ? copy.undated[`done${periodKind(task.repeat)}`]
          : repeatLabel(task.repeat, task.repeatEvery)}
        <CheckHistory task={task} weekStart={weekStart} />
      </>
    ) : task.alert ? (
      <>
        <Bell role="img" aria-label={copy.undated.reminder} />
        {weekday(zoned(task.alert).getDay())} {clockAt(task.alert, hour12)}
      </>
    ) : (
      copy.day.noDate
    );

  const row = (
    <AnytimeItem
      title={task.title}
      done={done}
      meta={meta}
      first={first}
      selected={!swipe && panel?.kind === "task" && panel.id === task.id}
      onToggle={() => void toggle()}
      onOpen={swipe ? () => setOpen(true) : () => openPanel({ kind: "task", id: task.id })}
      draggable={drag}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    />
  );

  if (!swipe) return row;
  return (
    <EditTask open={open} onOpenChange={setOpen}>
      <SwipeActions onComplete={() => void toggle()} onDelete={() => void remove()}>
        {row}
      </SwipeActions>
      <EditTaskContent
        task={task}
        day={zoned(task.date)}
        open={open}
        onClose={() => setOpen(false)}
      />
      {deleteDialog}
    </EditTask>
  );
}

/**
 * Última linha do bloco (desktop): Enter anota sem data, sem abrir a folha de criação. No mobile o
 * composer do rodapé já faz isso.
 */
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
      className="hidden min-h-12 items-center gap-3 pr-4 pl-1.5 md:flex"
    >
      <Plus className="size-11 flex-none p-3 text-ink-secondary" aria-hidden />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={copy.undated.capture}
        aria-label={copy.undated.capture}
        className="min-w-0 flex-1 self-stretch border-t border-separator bg-transparent text-subhead outline-none placeholder:text-ink-tertiary"
      />
    </form>
  );
}

const pendingLabel = (n: number): string =>
  countLabel(n, copy.undated.onePending, copy.undated.manyPending);

/** Topo de hoje: recorrentes (marcadas por período), afazeres sem data e o campo de anotar. */
export function AnytimeBlock(): JSX.Element {
  const { undatedTasks, weekStart } = useDailify();
  const swipe = useMediaQuery(MOBILE);
  const drag = !useMediaQuery(NO_DRAG);
  const { recurring, todo } = splitUndated(undatedTasks ?? []);
  const rows = [...recurring, ...todo];

  return (
    <AnytimeCard
      busy={undatedTasks === undefined}
      empty={rows.length === 0}
      pending={undatedTasks && pendingUndated(undatedTasks, Date.now(), weekStart)}
    >
      {rows.map((task, i) => (
        <AnytimeRow key={task.id} task={task} swipe={swipe} drag={drag} first={i === 0} />
      ))}
      <CaptureField />
    </AnytimeCard>
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
        <p className="text-footnote text-ink-secondary">{label}</p>
        <p className="truncate text-subhead text-ink">{task.title}</p>
      </div>
      <TimeWheel value={at} onChange={setAt} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          {copy.form.cancel}
        </Button>
        <Button
          size="sm"
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
  const label = fill(copy.undated.scheduleTitle, { day: dayDot(day) });

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
