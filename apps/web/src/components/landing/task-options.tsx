import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Bell, Check, CheckCircle, Edit, Repeat, Trash2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Checklist } from "./checklist";
import { NowLine } from "./now-line";
import { recorrenciaMeta } from "./scenes/scene-recorrencia";
import { scheduleMeta } from "./scenes/scene-horarios";
import { boxResolveMs, CROSSFADE_S } from "./scenes/timing";

/**
 * Box flutuante ao lado da lista — SEMPRE montado (slot fixo); só o CONTEÚDO troca por cena, via
 * `AnimatePresence` interno (mesmo `useCycle` do hero). Scene-aware: em "tarefas" (0) o menu de
 * ações; em "horários" (1) o "Agora / A seguir"; em "recorrência" (2) a sequência/streak.
 * Tarefas e horários têm skeleton na cena → o box mostra o ícone da família (<Checklist>/<NowLine>)
 * e faz crossfade SIMULTÂNEO pro conteúdo (grid-stack, igual o TaskCard) no MESMO instante que o
 * último item da cena resolve (~1710ms). `reduce` colapsa pro estado final. Mock, sem interação.
 */
const OPTIONS: { icon: LucideIcon; label: string; danger?: boolean }[] = [
  { icon: CheckCircle, label: "Concluir" },
  { icon: Edit, label: "Editar" },
  { icon: Bell, label: "Lembrete" },
  { icon: Repeat, label: "Recorrência" },
  { icon: Trash2, label: "Excluir", danger: true },
];

const EXPO = [0.16, 1, 0.3, 1] as const;

// Tarefas e horários têm 4 itens → o box cruza junto com o último (SKELETON_MS + 3*RESOLVE_STAGGER).
const BOX_SKELETON_MS = boxResolveMs(4);

const contentVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EXPO } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2, ease: EXPO } },
};
const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const checkVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: EXPO } },
};

/**
 * Slot da cena que tem skeleton (tarefas/horários): ícone da família ↔ conteúdo, empilhados no grid
 * e cruzando a opacidade em `resolved` (mesmo 0.45s do TaskCard).
 */
function SceneBox({
  reduce,
  resolved,
  icon,
  children,
}: {
  reduce: boolean;
  resolved: boolean;
  icon: JSX.Element;
  children: JSX.Element;
}): JSX.Element {
  return (
    <motion.div
      variants={contentVariants}
      initial={reduce ? false : "hidden"}
      animate="visible"
      exit={reduce ? undefined : "exit"}
      className="grid flex-1"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none col-start-1 row-start-1 flex items-center justify-center"
        initial={false}
        animate={{ opacity: resolved ? 0 : 1 }}
        transition={{ duration: CROSSFADE_S, ease: EXPO }}
      >
        {icon}
      </motion.div>
      <motion.div
        className="col-start-1 row-start-1 flex flex-col"
        initial={false}
        animate={{ opacity: resolved ? 1 : 0 }}
        transition={{ duration: CROSSFADE_S, ease: EXPO }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Conteúdo do menu de ações (o crossfade do box controla a opacidade). */
function ActionsMenuBody(): JSX.Element {
  return (
    <>
      <div className="px-2 pb-2 pt-1">
        <p className="truncate text-sm font-medium text-foreground">Revisar proposta</p>
        <p className="font-mono text-2xs text-muted-foreground">08:30 · 30min</p>
      </div>

      <div className="h-px bg-surface-line" />

      <ul className="mt-1 flex flex-col gap-0.5">
        {OPTIONS.map(({ icon: Icon, label, danger }, i) => (
          <li
            key={label}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs",
              i === 0 && "bg-surface-hover text-foreground",
              i !== 0 && !danger && "text-content-secondary",
              danger && "text-destructive",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Conteúdo do "Agora / A seguir". */
function AgoraNextBody(): JSX.Element {
  const { nowLabel, next } = scheduleMeta;
  return (
    <>
      <div className="px-2 pb-2 pt-1">
        <p className="font-mono text-2xl font-medium tabular-nums text-foreground">{nowLabel}</p>
        <p className="font-mono text-2xs tracking-[0.08em] text-accent-primary">AGORA</p>
      </div>

      <div className="h-px bg-surface-line" />

      {next && (
        <div className="px-2 pt-2">
          <p className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">A seguir</p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{next.title}</p>
          <p className="font-mono text-2xs text-muted-foreground">
            {next.timeLabel} · {next.durLabel}
          </p>
        </div>
      )}
    </>
  );
}

/** Cena "recorrência": streak da série (sem skeleton por ora — entra direto). */
function StreakWidget({ reduce }: { reduce: boolean }): JSX.Element {
  const { streakWeeks, next } = recorrenciaMeta;
  return (
    <motion.div
      variants={contentVariants}
      initial={reduce ? false : "hidden"}
      animate="visible"
      exit={reduce ? undefined : "exit"}
      className="flex flex-1 flex-col"
    >
      <div className="px-2 pb-2 pt-1">
        <p className="text-2xs uppercase tracking-[0.06em] text-muted-foreground">Sequência</p>
        <p className="mt-0.5 flex items-baseline gap-1.5">
          <span className="font-mono text-2xl font-medium tabular-nums text-foreground">
            {streakWeeks}
          </span>
          <span className="text-xs text-muted-foreground">semanas seguidas</span>
        </p>
      </div>

      <div className="h-px bg-surface-line" />

      <div className="px-2 pt-3">
        <motion.div variants={listVariants} className="grid grid-cols-4 gap-1.5">
          {Array.from({ length: streakWeeks }).map((_, i) => (
            <motion.span
              key={i}
              variants={checkVariants}
              className="flex aspect-square items-center justify-center rounded-md bg-accent-subtle text-accent-primary"
            >
              <Check className="size-3.5" aria-hidden="true" />
            </motion.span>
          ))}
        </motion.div>
        <p className="mt-3 font-mono text-2xs text-muted-foreground">Próxima · {next.date}</p>
      </div>
    </motion.div>
  );
}

export function TaskOptions({
  activeWord,
  reduce,
}: {
  activeWord: number;
  reduce: boolean;
}): JSX.Element {
  // tarefas (0) e horários (1) têm skeleton na cena → o box cruza o ícone→conteúdo junto com ela.
  const [resolved, setResolved] = useState(
    () => !((activeWord === 0 || activeWord === 1) && !reduce),
  );

  useEffect(() => {
    const hasSkeleton = activeWord === 0 || activeWord === 1;
    if (!hasSkeleton || reduce) {
      setResolved(true);
      return;
    }
    setResolved(false);
    const t = setTimeout(() => setResolved(true), BOX_SKELETON_MS);
    return () => clearTimeout(t);
  }, [activeWord, reduce]);

  return (
    <div
      aria-hidden="true"
      className="relative flex h-56 w-56 flex-col rounded-panel border border-surface-line bg-surface-panel p-2 shadow-panel"
    >
      <AnimatePresence mode="wait">
        {activeWord === 0 && (
          <SceneBox
            key="tarefas"
            reduce={reduce}
            resolved={resolved}
            icon={<Checklist size={84} animated={!reduce} />}
          >
            <ActionsMenuBody />
          </SceneBox>
        )}
        {activeWord === 1 && (
          <SceneBox
            key="agora"
            reduce={reduce}
            resolved={resolved}
            icon={<NowLine size={84} animated={!reduce} />}
          >
            <AgoraNextBody />
          </SceneBox>
        )}
        {activeWord === 2 && <StreakWidget key="streak" reduce={reduce} />}
      </AnimatePresence>
    </div>
  );
}
