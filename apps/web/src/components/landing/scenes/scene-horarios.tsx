import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import { NowLine } from "../now-line";

/**
 * Cena "horários" do painel do hero (activeWord===1). Duas fases, como a recorrência: (A) intro
 * ~INTRO_MS = o ícone <NowLine> animado no centro; (B) resolve pra agenda compacta empilhada —
 * cada linha traz a hora de início + um `TimeBlock` UNIFORME (mesmo estilo, só mudam os valores)
 * com a duração; a linha do "agora" fica em accent com o marcador AGORA. `reduce` vai direto pra
 * agenda, sem intro.
 */

const INTRO_MS = 1600; // duração da Fase A (ícone) antes de resolver
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

/** Bloco da agenda — MESMO estilo pra todos; só `title`/`durLabel`/`now` mudam. */
function TimeBlock({
  title,
  durLabel,
  now,
  className,
}: {
  title: string;
  durLabel: string;
  now: boolean;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "relative flex items-center justify-between gap-2 rounded-lg border py-2 pl-3 pr-2.5",
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
      <span
        className={cn(
          "truncate text-sm font-medium",
          now ? "text-foreground" : "text-content-secondary",
        )}
      >
        {title}
      </span>
      <span className="shrink-0 font-mono text-2xs text-muted-foreground">{durLabel}</span>
    </div>
  );
}

/** Fase B: a agenda empilhada (hora + TimeBlock + slot do AGORA). */
function Agenda({ reduce }: { reduce: boolean }): JSX.Element {
  return (
    <motion.ul
      variants={trackVariants}
      initial={reduce ? "visible" : "hidden"}
      animate="visible"
      className="flex flex-col gap-2"
    >
      {SLOTS.map((s) => {
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

            <TimeBlock title={s.title} durLabel={s.durLabel} now={now} className="flex-1" />

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

export function SceneHorarios({ reduce }: { reduce: boolean }): JSX.Element {
  // fase: 'intro' (ícone) → 'agenda' (conteúdo). reduce vai direto pra agenda.
  const [phase, setPhase] = useState<"intro" | "agenda">(reduce ? "agenda" : "intro");

  useEffect(() => {
    if (reduce) return;
    setPhase("intro");
    const t = setTimeout(() => setPhase("agenda"), INTRO_MS);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div className="flex min-h-80 flex-col justify-center">
      <AnimatePresence mode="wait">
        {phase === "intro" ? (
          <motion.div
            key="intro"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3, ease: EXPO }}
            className="flex justify-center"
          >
            <NowLine size={120} animated={!reduce} />
          </motion.div>
        ) : (
          <motion.div
            key="agenda"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: EXPO }}
          >
            <Agenda reduce={reduce} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
