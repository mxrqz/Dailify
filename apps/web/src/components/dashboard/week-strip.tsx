import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { addDays, format, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { motion, MotionConfig } from "motion/react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTasksForDay } from "@/functions/functions";
import { spring } from "@/consts/motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const DAYS_AHEAD = 7;
const MAX_DOTS = 3;
// Espelha o h-10 da AppHeader: a faixa acopla quando o topo dela encosta na barra.
const HEADER_PX = 40;
// Só desacopla alguns px abaixo de onde acoplou: com o dedo parado no limiar ela trocava a cada frame.
const HYSTERESIS_PX = 8;
// Espelham rounded-2xl/rounded-xl/rounded-lg. Números porque o motion só corrige o raio durante a
// escala do morph quando ele vem pelo animate, não por classe.
const RADIUS_STRIP = 16;
const RADIUS_DAY = 12;
const RADIUS_DAY_DOCKED = 8;

export const weekDays = (): Date[] => {
  const today = startOfDay(new Date());
  return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
};

/** Mobile: a doca da página (o placeholder) chegou na top bar. */
function useDocked(dock: RefObject<HTMLElement>): boolean {
  const [docked, setDocked] = useState(false);
  const { setStripDocked } = useDailify();
  const mobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    const el = dock.current;
    if (!el || !mobile) return;
    const line = (px: number) => ({ rootMargin: `-${px}px 0px 0px 0px`, threshold: 1 });
    const dockAt = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < 1 && entry.boundingClientRect.top < HEADER_PX) setDocked(true);
    }, line(HEADER_PX));
    const undockAt = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio === 1) setDocked(false);
      },
      line(HEADER_PX + HYSTERESIS_PX),
    );
    dockAt.observe(el);
    undockAt.observe(el);
    return () => {
      dockAt.disconnect();
      undockAt.disconnect();
      setDocked(false);
    };
  }, [dock, mobile]);

  // O header esconde marca e ações enquanto a faixa ocupa o centro dele.
  useEffect(() => setStripDocked(docked), [docked, setStripDocked]);
  useEffect(() => () => setStripDocked(false), [setStripDocked]);

  return docked;
}

/**
 * Os próximos sete dias em uma linha, com um ponto nos que têm tarefa; o mês inteiro fica no popover.
 *
 * No mobile é UM elemento com duas docas: o card na página e, ao rolar, o centro da top bar (entre o
 * ☰ e a mesma folga do outro lado). É o mesmo nó nas duas — o motion anima a troca (layout/FLIP) — e
 * o espaço do card fica reservado pra lista não pular.
 */
export function WeekStrip(): JSX.Element {
  const { tasks, goToDay } = useDailify();
  const days = weekDays();
  const dock = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const docked = useDocked(dock);
  const [height, setHeight] = useState<number>();

  // A altura da doca da página é a do card aberto; medida enquanto ele está nela.
  useLayoutEffect(() => {
    if (!docked && strip.current) setHeight(strip.current.offsetHeight);
  }, [docked, tasks]);

  const box = { layout: true, layoutDependency: docked } as const;
  const leaf = { layout: "position", layoutDependency: docked } as const;

  return (
    <div ref={dock} style={{ height }} className="relative md:h-auto!">
      <MotionConfig transition={spring.soft}>
        <motion.div
          ref={strip}
          {...box}
          initial={false}
          animate={{ borderRadius: docked ? 0 : RADIUS_STRIP }}
          className={cn(
            "z-30 flex items-center overflow-hidden transition-colors",
            docked
              ? // h-9.75: para 1px acima da borda de baixo da top bar, que segue inteira por baixo.
                "fixed inset-x-12 top-0 h-9.75 gap-0.5 bg-surface-page"
              : "absolute inset-x-0 top-0 gap-1 border border-surface-line bg-surface-card p-2 md:static",
          )}
        >
          {days.map((day) => {
            const current = isToday(day);
            const dots = Math.min(tasks ? getTasksForDay(tasks, day).length : 0, MAX_DOTS);

            return (
              <motion.button
                key={day.toISOString()}
                {...box}
                initial={false}
                animate={{ borderRadius: docked ? RADIUS_DAY_DOCKED : RADIUS_DAY }}
                type="button"
                onClick={() => void goToDay(day)}
                aria-current={current ? "date" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 cursor-pointer items-center justify-center transition-colors",
                  docked ? "h-8 gap-0.5" : "flex-col gap-1 px-2 py-2",
                  current ? "bg-surface-hover" : "hover:bg-surface-hover",
                )}
              >
                <motion.span
                  {...leaf}
                  className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
                >
                  {format(day, docked ? "EEEEE" : "EEEEEE", { locale: ptBR })}
                </motion.span>

                <motion.span
                  {...leaf}
                  className={cn(
                    "text-sm font-medium",
                    current ? "text-accent-primary" : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </motion.span>

                {/* Altura reservada mesmo sem tarefa: senão os dias sobem e descem na faixa. Acoplada,
                    a faixa só tem espaço pra um ponto. */}
                <motion.span
                  {...box}
                  className={cn("flex h-1 items-center gap-0.5 overflow-hidden", docked && "w-1")}
                  aria-hidden="true"
                >
                  {Array.from({ length: dots }).map((_, index) => (
                    <motion.span
                      key={index}
                      {...leaf}
                      className="size-1 shrink-0 rounded-full bg-accent-primary"
                    />
                  ))}
                </motion.span>
              </motion.button>
            );
          })}

          {/* Fica nas duas docas: sair com animação deixava a linha se reacomodar sem animar no fim
              do morph — o "pulo" ao acoplar. */}
          <Popover>
            <PopoverTrigger asChild>
              <motion.button
                {...box}
                initial={false}
                animate={{ borderRadius: docked ? RADIUS_DAY_DOCKED : RADIUS_DAY }}
                aria-label={copy.day.openCalendar}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground",
                  docked ? "size-8" : "size-9",
                )}
              >
                <motion.span {...leaf} className="flex">
                  <CalendarIcon className="size-4" />
                </motion.span>
              </motion.button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-auto border-surface-line bg-surface-card p-3">
              <MiniCalendar />
            </PopoverContent>
          </Popover>
        </motion.div>
      </MotionConfig>
    </div>
  );
}
