import { useEffect, useState } from "react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "motion/react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { dayAnchorId } from "@/components/dashboard/day-section";
import { stripDayLayoutId, weekDays } from "@/components/dashboard/week-strip";
import { getTasksForDay } from "@/functions/functions";
import { spring } from "@/consts/motion";
import { cn } from "@/lib/utils";

/** O dia cuja seção está no topo da lista; um clique fixa o dia até o próximo gesto do usuário. */
function useVisibleDay(days: Date[]): string | undefined {
  const { tasks, targetDay } = useDailify();
  const [visible, setVisible] = useState<string>();
  const [pinned, setPinned] = useState<string>();
  const firstDay = days[0].getTime();

  useEffect(() => {
    const ids = days.map(dayAnchorId);
    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) seen.add(entry.target.id);
          else seen.delete(entry.target.id);
        }
        setVisible(ids.find((id) => seen.has(id)));
      },
      // Uma faixa logo abaixo do header: "visível" é o que está sendo lido, não o que aparece na base.
      { rootMargin: "-48px 0px -60% 0px" },
    );
    for (const id of ids) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
    // As seções nascem com as tarefas e com o dia-alvo; os dias da semana só mudam à meia-noite.
  }, [tasks, targetDay, firstDay]);

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

/** A semana compacta que toma o lugar da marca no header do mobile quando a faixa sai de vista. */
export function HeaderWeek(): JSX.Element {
  const { tasks, goToDay } = useDailify();
  const days = weekDays();
  const visible = useVisibleDay(days);

  return (
    <nav aria-label={copy.header.week} className="flex min-w-0 flex-1 justify-center gap-0.5">
      {days.map((day) => {
        const busy = tasks ? getTasksForDay(tasks, day).length > 0 : false;
        const current = isToday(day);

        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => void goToDay(day)}
            aria-label={format(day, "EEEE, d", { locale: ptBR })}
            aria-current={current ? "date" : undefined}
            className={cn(
              "relative flex h-8 w-6.5 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg transition-colors after:absolute after:-inset-x-0.5 after:-inset-y-1 after:content-['']",
              dayAnchorId(day) === visible && "bg-surface-hover",
            )}
          >
            <motion.span
              layoutId={stripDayLayoutId(day)}
              transition={spring.soft}
              className={cn(
                "text-sm/none font-medium",
                current ? "text-accent-primary" : "text-foreground",
              )}
            >
              {format(day, "d")}
            </motion.span>
            <span
              aria-hidden="true"
              className={cn("size-1 rounded-full", busy ? "bg-accent-primary" : "bg-transparent")}
            />
          </button>
        );
      })}
    </nav>
  );
}
