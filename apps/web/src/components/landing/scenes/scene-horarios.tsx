import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { CROSSFADE_S, RESOLVE_STAGGER_MS, SKELETON_MS } from "./timing";

/**
 * Cena "horários" do painel do hero (activeWord===1): as MESMAS tarefas da cena de lista, agora
 * como uma agenda compacta empilhada — cada linha traz a hora de início + um `TimeBlock` UNIFORME
 * (mesmo estilo, só mudam os valores) com a duração. Igual tarefas, os blocos entram como skeleton
 * e resolvem 1 a 1 (crossfade dentro do TimeBlock); a linha que contém o "agora" fica em accent com
 * o marcador AGORA. `reduce` colapsa pro estado final.
 */

const AGORA_MIN = 592; // 09:52 — cai dentro da "Reunião de time"

const pad = (n: number): string => String(n).padStart(2, "0");
const label = (min: number): string => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

interface Slot {
  title: string;
  startMin: number;
  durMin: number;
  durLabel: string;
}

const SLOTS: readonly Slot[] = [
  { title: "Revisar proposta", startMin: 540, durMin: 30, durLabel: "30min" },
  { title: "Reunião de time", startMin: 570, durMin: 45, durLabel: "45min" },
  { title: "Escrever relatório", startMin: 630, durMin: 90, durLabel: "1h30" },
  { title: "Deploy da build", startMin: 735, durMin: 20, durLabel: "20min" },
] as const;

const isNow = (s: Slot): boolean => s.startMin <= AGORA_MIN && AGORA_MIN < s.startMin + s.durMin;

/** Meta pro widget "Agora / A seguir" do box (task-options), derivada do mesmo schedule. */
const nextSlot = SLOTS.find((s) => s.startMin > AGORA_MIN);
export const scheduleMeta = {
  nowLabel: label(AGORA_MIN),
  next: nextSlot
    ? { title: nextSlot.title, timeLabel: label(nextSlot.startMin), durLabel: nextSlot.durLabel }
    : null,
};

const EXPO = [0.16, 1, 0.3, 1] as const; // ease-out-expo

const trackVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EXPO } },
};

/**
 * Bloco da agenda — MESMO estilo pra todos; só `title`/`durLabel`/`now` mudam. Skeleton e conteúdo
 * ficam EMPILHADOS (grid) e cruzam a opacidade em `loading` (mesmo crossfade do TaskCard).
 */
function TimeBlock({
  title,
  durLabel,
  now,
  loading,
  className,
}: {
  title: string;
  durLabel: string;
  now: boolean;
  loading: boolean;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "relative grid rounded-lg border py-2 pl-3 pr-2.5",
        now ? "border-accent-primary bg-accent-subtle" : "border-surface-line bg-transparent",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-0.5 rounded-l",
          now ? "bg-accent-primary" : "bg-muted-foreground/40",
        )}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none col-start-1 row-start-1 flex items-center justify-between gap-2"
        initial={false}
        animate={{ opacity: loading ? 1 : 0 }}
        transition={{ duration: CROSSFADE_S, ease: EXPO }}
      >
        <span className="skeleton h-3.5 w-24 rounded" />
        <span className="skeleton h-3 w-8 rounded" />
      </motion.div>
      <motion.div
        className="col-start-1 row-start-1 flex items-center justify-between gap-2"
        initial={false}
        animate={{ opacity: loading ? 0 : 1 }}
        transition={{ duration: CROSSFADE_S, ease: EXPO }}
      >
        <span
          className={cn(
            "truncate text-sm font-medium",
            now ? "text-foreground" : "text-content-secondary",
          )}
        >
          {title}
        </span>
        <span className="shrink-0 font-mono text-2xs text-muted-foreground">{durLabel}</span>
      </motion.div>
    </div>
  );
}

export function SceneHorarios({ reduce }: { reduce: boolean }): JSX.Element {
  // nº de blocos já resolvidos (de cima pra baixo); bloco i troca skeleton→conteúdo quando resolved > i.
  const [resolved, setResolved] = useState(reduce ? SLOTS.length : 0);

  useEffect(() => {
    if (reduce) return;
    setResolved(0);
    const timers = SLOTS.map((_, i) =>
      setTimeout(
        () => setResolved((n) => Math.max(n, i + 1)),
        SKELETON_MS + i * RESOLVE_STAGGER_MS,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  return (
    <motion.ul
      variants={trackVariants}
      initial={reduce ? "visible" : "hidden"}
      animate="visible"
      className="flex flex-col gap-2"
    >
      {SLOTS.map((s, i) => {
        const now = isNow(s);
        return (
          <motion.li key={s.title} variants={rowVariants} className="flex items-center gap-3">
            {/* hora de início (+ dot na linha do agora) */}
            <span className="flex w-12 shrink-0 items-center justify-end gap-1.5 font-mono text-2xs text-muted-foreground">
              {now && (
                <span className="size-1.5 rounded-full bg-accent-primary shadow-[0_0_5px_var(--accent-glow)]" />
              )}
              {label(s.startMin)}
            </span>

            <TimeBlock
              title={s.title}
              durLabel={s.durLabel}
              now={now}
              loading={i >= resolved}
              className="flex-1"
            />

            {/* slot fixo do AGORA (mantém a largura dos blocos alinhada) */}
            <span className="w-12 shrink-0 font-mono text-2xs tracking-[0.08em] text-accent-primary">
              {now ? "AGORA" : ""}
            </span>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}
