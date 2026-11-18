import { useEffect, useState, type ReactNode } from "react";
import { eachDayOfInterval, endOfWeek, format, isSameDay, isToday, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { ScheduleDrop } from "@/components/dashboard/anytime-block";
import { dayAnchorId } from "@/components/dashboard/day-section";
import { capitalize, getTasksForDay } from "@/functions/functions";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";

// Uma seção vira "o dia que se está vendo" quando o topo dela sobe até aqui (logo abaixo da barra).
const READING_LINE_PX = 64;

/** O dia cuja seção está sendo lida no topo da lista; um clique fixa o dia até o próximo gesto. */
function useVisibleDay(days: Date[]): string | undefined {
  const { tasks, targetDay } = useDailify();
  const [visible, setVisible] = useState<string>();
  const [pinned, setPinned] = useState<string>();
  const firstDay = days[0].getTime();
  // `days` é um array novo a cada render; quem dispara a releitura é o `firstDay`.
  const inWeek = useEffectEvent((id: string) => days.some((day) => dayAnchorId(day) === id));

  useEffect(() => {
    let frame = 0;
    // O dia "atual" é a última seção cujo topo já passou da linha de leitura (logo abaixo da barra);
    // lido na rolagem, e não por observer, porque as seções nascem depois (cache, meses chegando).
    const update = () => {
      frame = 0;
      const sections = document.querySelectorAll<HTMLElement>("section[id^='day-']");
      let current = sections[0];
      for (const section of sections) {
        if (section.getBoundingClientRect().top > READING_LINE_PX) break;
        current = section;
      }
      setVisible(current && inWeek(current.id) ? current.id : undefined);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
    // Reavalia quando a lista muda; os dias da semana só mudam à meia-noite.
  }, [tasks, firstDay]);

  useEffect(() => {
    if (!targetDay) return;
    setPinned(dayAnchorId(targetDay));
    // Rolagem programática não dispara estes eventos: só o dedo, a roda ou o teclado soltam o dia.
    const release = () => setPinned(undefined);
    const events = ["touchstart", "wheel", "keydown"] as const;
    for (const event of events) window.addEventListener(event, release, { passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, release);
    };
  }, [targetDay]);

  return pinned ?? visible;
}

/**
 * A semana em sete pílulas (props → markup). A escolhida é a pílula `ink`; o ponto de "tem tarefa"
 * fica FORA dela, embaixo, pra ler igual escolhida ou não.
 */
export function WeekDays({
  days,
  selected,
  marked,
  onPick,
  wrap = (_, node) => node,
}: {
  days: Date[];
  selected?: Date;
  marked: (day: Date) => boolean;
  onPick: (day: Date) => void;
  /** Envolve cada dia (o alvo de soltar do desktop). */
  wrap?: (day: Date, node: JSX.Element) => ReactNode;
}): JSX.Element {
  return (
    <div role="group" aria-label={copy.day.week} className="grid grid-cols-7 gap-1">
      {days.map((day) => {
        const on = selected !== undefined && isSameDay(day, selected);
        const label = weekdayLabel(day);
        const has = marked(day);
        return (
          <div key={day.getTime()} className="flex flex-col items-center gap-1.5">
            {wrap(
              day,
              <button
                type="button"
                onClick={() => onPick(day)}
                aria-pressed={on}
                aria-current={isToday(day) ? "date" : undefined}
                aria-label={has ? copy.day.withTasks.replace("{day}", label) : label}
                className={cn(
                  "flex h-13 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md transition-colors duration-fast",
                  "data-drop-over:outline-2 data-drop-over:-outline-offset-2 data-drop-over:outline-brand",
                  on ? "bg-ink text-canvas" : "hover:bg-fill pointer-fine:active:bg-fill-pressed",
                )}
              >
                <small
                  className={cn(
                    "text-xs font-medium",
                    on ? "text-ink-tertiary" : "text-ink-secondary",
                  )}
                >
                  {copy.aside.weekDayInitials[day.getDay()]}
                </small>
                <span
                  className={cn(
                    "text-body font-semibold tabular-nums",
                    !on && isToday(day) && "text-brand-text",
                  )}
                >
                  {format(day, "d")}
                </span>
              </button>,
            )}
            <i
              aria-hidden="true"
              className={cn("size-1 rounded-full", has ? "bg-ink-secondary" : "bg-transparent")}
            />
          </div>
        );
      })}
    </div>
  );
}

const weekdayLabel = (day: Date) =>
  capitalize(format(day, "EEEE, d 'de' MMMM", { locale: ptBR }).replace("-feira", ""));

/** A semana de hoje (respeitando o primeiro dia da config); muda só à meia-noite. */
export function useWeek(): Date[] {
  const { weekStart } = useDailify();
  const now = useNow("day");
  const opts = { weekStartsOn: weekStart };
  return eachDayOfInterval({ start: startOfWeek(now, opts), end: endOfWeek(now, opts) });
}

/** A semana da Hoje: a pílula acompanha o dia que se está lendo na lista; tocar rola até ele. */
export function WeekStrip(): JSX.Element {
  const { tasks, goToDay } = useDailify();
  const days = useWeek();
  const visible = useVisibleDay(days);

  return (
    <WeekDays
      days={days}
      selected={days.find((day) => dayAnchorId(day) === visible)}
      marked={(day) => (tasks ? getTasksForDay(tasks, day).length > 0 : false)}
      onPick={(day) => void goToDay(day)}
      wrap={(day, node) => <ScheduleDrop day={day}>{node}</ScheduleDrop>}
    />
  );
}
