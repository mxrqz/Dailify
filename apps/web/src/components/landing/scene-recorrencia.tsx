import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Orbit } from "./orbit";
import { TagBadge } from "./task-card";

/**
 * Cena "recorrência" (activeWord===2). Duas fases, no espírito do skeleton→conteúdo das tarefas:
 * (A) o laço <Orbit> gira no centro por ~LOOP_MS como "skeleton", com a cadência alternando
 * Diário→Semanal→Mensal em crossfade; (B) o laço dissolve e resolve pro "Config + próximas":
 * card recorrente (ícone Orbit estático) + seletor de cadência + preview das próximas ocorrências.
 * `reduce` vai direto pro estado de repouso (Fase B), sem laço nem animação.
 */

const LOOP_MS = 3000; // duração da Fase A antes de resolver
const CAD_MS = 1000; // troca da cadência em rodízio na Fase A
const EXPO = [0.16, 1, 0.3, 1] as const;

const CADENCES = ["Diário", "Semanal", "Mensal"] as const;
const ACTIVE_CAD = 1; // "Semanal" fica selecionada no repouso

interface Occurrence {
  date: string;
  time: string;
}
const PROXIMAS: readonly Occurrence[] = [
  { date: "seg, 4 ago", time: "10:00" },
  { date: "seg, 11 ago", time: "10:00" },
  { date: "seg, 18 ago", time: "10:00" },
] as const;

const bodyVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const blockVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EXPO } },
};

/** Pílula de cadência (crossfade suave de cor ao alternar/selecionar). */
function CadencePill({ label, active }: { label: string; active: boolean }): JSX.Element {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-2xs transition-colors duration-500",
        active
          ? "border-accent-primary bg-accent-subtle text-accent-primary"
          : "border-surface-line text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** Fase A: laço girando + cadência em rodízio Diário→Semanal→Mensal. */
function LoopPhase({ reduce }: { reduce: boolean }): JSX.Element {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setActive((n) => (n + 1) % CADENCES.length), CAD_MS);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="flex flex-col items-center gap-7">
      <Orbit size={176} animated={!reduce} glow glyph speed={6} strokeWidth={1} dash={[2, 8]} />
      <div className="flex gap-2">
        {CADENCES.map((c, i) => (
          <CadencePill key={c} label={c} active={i === active} />
        ))}
      </div>
    </div>
  );
}

/** Card da task recorrente — 3 colunas: ícone Orbit | (title/tags/regra) | badge. */
function RecurringCard(): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-surface-line px-4 py-3.5">
      <Orbit
        size={38}
        className="shrink-0 self-center"
        ringClassName="stroke-muted-foreground"
        dotClassName="fill-muted-foreground"
        gapDegrees={90}
        strokeWidth={3}
        dash={[3, 9]}
        headRadius={12}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold text-foreground">Reunião de time</span>
        <div className="flex gap-1.5">
          <TagBadge label="time" />
          <TagBadge label="sync" />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">└</span>
          <span className="text-content-secondary">toda segunda · 10:00</span>
        </div>
      </div>
      <Badge
        variant="outline"
        className="shrink-0 border-accent-primary px-2.5 py-0.5 text-2xs font-normal text-accent-primary"
      >
        Semanal
      </Badge>
    </div>
  );
}

/** Preview das próximas ocorrências geradas (série da mesma task; a próxima em accent). */
function ProximasList(): JSX.Element {
  return (
    <div>
      <p className="mb-2 text-2xs uppercase tracking-[0.08em] text-muted-foreground">
        Próximas ocorrências
      </p>
      <div className="relative flex flex-col gap-0.5">
        {/* conector tracejado ligando as ocorrências (dots por cima) */}
        <span
          aria-hidden
          className="absolute bottom-2 left-[3px] top-2 border-l border-dashed border-surface-line"
        />
        {PROXIMAS.map((o, i) => (
          <div
            key={o.date}
            className={cn(
              "relative flex items-center gap-2.5 py-1 text-xs",
              i === 0 ? "text-foreground" : "text-content-secondary",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                i === 0
                  ? "bg-accent-primary shadow-[0_0_6px_var(--accent-glow)]"
                  : "border border-muted-foreground",
              )}
            />
            <span>{o.date}</span>
            <span className="ml-auto font-mono text-2xs text-muted-foreground">{o.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SceneRecorrencia({ reduce }: { reduce: boolean }): JSX.Element {
  // fase: 'loop' (laço/skeleton) → 'config' (repouso). reduce vai direto pro repouso.
  const [phase, setPhase] = useState<"loop" | "config">(reduce ? "config" : "loop");

  useEffect(() => {
    if (reduce) return;
    setPhase("loop");
    const t = setTimeout(() => setPhase("config"), LOOP_MS);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div className="flex min-h-[20rem] flex-col justify-center">
      <AnimatePresence mode="wait">
        {phase === "loop" ? (
          <motion.div
            key="loop"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3, ease: EXPO }}
          >
            <LoopPhase reduce={reduce} />
          </motion.div>
        ) : (
          <motion.div
            key="config"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3, ease: EXPO }}
          >
            <motion.div
              variants={bodyVariants}
              initial={reduce ? "visible" : "hidden"}
              animate="visible"
              className="flex flex-col gap-4"
            >
              <motion.div variants={blockVariants}>
                <RecurringCard />
              </motion.div>
              <motion.div variants={blockVariants} className="flex gap-2">
                {CADENCES.map((c, i) => (
                  <CadencePill key={c} label={c} active={i === ACTIVE_CAD} />
                ))}
              </motion.div>
              <motion.div variants={blockVariants}>
                <ProximasList />
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
