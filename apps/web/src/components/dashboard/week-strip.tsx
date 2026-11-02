import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { addDays, format, isToday, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { motion, MotionConfig } from "motion/react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { dayAnchorId } from "@/components/dashboard/day-section";
import { DayPicker } from "@/components/dashboard/day-picker";
import { calendarPanel } from "@/components/dashboard/styles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getTasksForDay } from "@/functions/functions";
import { spring } from "@/consts/motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

const DAYS_AHEAD = 7;
const MAX_DOTS = 3;
// Só desacopla alguns px abaixo de onde acoplou: com o dedo parado no limiar ela trocava a cada frame.
const HYSTERESIS_PX = 8;
// h-9.75 da faixa acoplada: para 1px acima da borda de baixo da top bar (h-10), que segue inteira.
const DOCKED_PX = 39;
// Uma seção vira "o dia que se está vendo" quando o topo dela sobe até aqui (o goToDay a para em 56).
const READING_LINE_PX = 64;
// Espelham rounded-2xl/rounded-xl/rounded-lg. Números porque o motion só corrige o raio durante a
// escala do morph quando ele vem pelo animate, não por classe.
const RADIUS_STRIP = 16;
const RADIUS_DAY = 12;
const RADIUS_DAY_DOCKED = 8;

export const weekDays = (): Date[] => {
  const today = startOfDay(new Date());
  return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
};

/** Mobile: o lugar da faixa na página (a sentinela logo acima dela) chegou ao topo da tela. */
function useDocked(sentinel: RefObject<HTMLElement>): boolean {
  const [docked, setDocked] = useState(false);
  const mobile = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !mobile) return;
    const line = (px: number) => ({ rootMargin: `-${px}px 0px 0px 0px` });
    const dockAt = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) setDocked(true);
    }, line(0));
    const undockAt = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setDocked(false);
    }, line(HYSTERESIS_PX));
    dockAt.observe(el);
    undockAt.observe(el);
    return () => {
      dockAt.disconnect();
      undockAt.disconnect();
      setDocked(false);
    };
  }, [sentinel, mobile]);

  // O header esconde marca e ações enquanto a faixa ocupa o centro dele.
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute("data-strip-docked", docked);
    return () => document.documentElement.removeAttribute("data-strip-docked");
  }, [docked]);

  return docked;
}

/** O dia cuja seção está sendo lida no topo da lista; um clique fixa o dia até o próximo gesto. */
function useVisibleDay(days: Date[]): string | undefined {
  const { tasks, targetDay } = useDailify();
  const [visible, setVisible] = useState<string>();
  const [pinned, setPinned] = useState<string>();
  const firstDay = days[0].getTime();

  useEffect(() => {
    const week = new Set(days.map(dayAnchorId));
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
      setVisible(current && week.has(current.id) ? current.id : undefined);
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
 * Os próximos sete dias em uma linha, com um ponto nos que têm tarefa; o mês inteiro fica no popover.
 *
 * No mobile é UM elemento com duas docas: o card na página e, ao rolar, o centro da top bar (entre o
 * ☰ e a mesma folga do outro lado). É o mesmo nó nas duas — o motion anima a troca (layout/FLIP) — e
 * o espaço do card fica reservado pra lista não pular.
 */
export function WeekStrip(): JSX.Element {
  const { tasks, goToDay, selectedDay } = useDailify();
  const days = weekDays();
  const visible = useVisibleDay(days);
  const sentinel = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const docked = useDocked(sentinel);
  const [height, setHeight] = useState(0);

  // Altura do card aberto: acoplada, a diferença vira um espaçador e a lista abaixo não se mexe.
  useLayoutEffect(() => {
    if (!docked && strip.current) setHeight(strip.current.offsetHeight);
  }, [docked, tasks]);

  const box = { layout: true, layoutDependency: docked } as const;
  const leaf = { layout: "position", layoutDependency: docked } as const;

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="h-px -mb-px" />
      <MotionConfig transition={spring.soft}>
        <motion.div
          ref={strip}
          {...box}
          initial={false}
          animate={{ borderRadius: docked ? 0 : RADIUS_STRIP }}
          // Sticky e não fixed: quem prende no topo é o navegador, na thread da rolagem. Trocar de
          // absolute pra fixed fazia o motion medir a partida com um scroll atrasado — o tranco.
          // Assim o morph é só de tamanho, ancorado no topo.
          className={cn(
            // Borda sempre de 1px (transparente acoplada): sumir com ela mudava a caixa no frame 0.
            "z-30 flex items-center overflow-hidden border transition-colors duration-base max-md:sticky max-md:top-0",
            docked
              ? // mx-8 + o px-gutter da página = 48px de cada lado: o ☰ continua livre.
                "mx-8 h-9.75 gap-0.5 border-transparent bg-surface-page"
              : "gap-1 border-surface-line bg-surface-card p-2",
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
                  // O fundo marca o dia que se está vendo na lista; hoje já se distingue pelo número.
                  dayAnchorId(day) === visible ? "bg-surface-hover" : "hover:bg-surface-hover",
                )}
              >
                {/* Os dois rótulos ficam montados e cruzam opacidade: trocar o texto no commit era
                    um pop no meio do morph. O de fora sai do fluxo pra não ocupar largura. */}
                <motion.span
                  {...leaf}
                  className="relative font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
                >
                  <span
                    className={cn(
                      "transition-opacity duration-base",
                      docked && "absolute top-0 left-0 opacity-0",
                    )}
                  >
                    {format(day, "EEEEEE", { locale: ptBR })}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "transition-opacity duration-base",
                      !docked && "absolute top-0 left-0 opacity-0",
                    )}
                  >
                    {format(day, "EEEEE", { locale: ptBR })}
                  </span>
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

            <PopoverContent align="end" className={calendarPanel}>
              <DayPicker value={selectedDay} onSelect={(day) => void goToDay(day)} />
            </PopoverContent>
          </Popover>
        </motion.div>
      </MotionConfig>
      {/* Espaçador e não margem: a margem colapsava com o mt-10 da lista e ela subia 40px. */}
      <div aria-hidden="true" style={{ height: docked ? height - DOCKED_PX : 0 }} />
    </>
  );
}
