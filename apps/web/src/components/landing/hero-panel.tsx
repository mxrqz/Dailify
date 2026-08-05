import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

/**
 * Painel animado da direita do hero. Lê `activeWord` do MESMO `useCycle` do subtítulo (via prop),
 * então a cena e a palavra crimson nunca dessincronizam. Cada palavra terá sua cena; por ora só
 * "tarefas" (0) está feita — 1/2 mostram um placeholder discreto no mesmo slot.
 *
 * `SceneTarefas` roda em 2 fases e replaya a cada reativação (a troca de `key` no `AnimatePresence`
 * remonta a cena): (A) skeleton com shimmer carrega rápido, (B) as tasks mock entram 1 a 1.
 * `reduce` (prefers-reduced-motion) colapsa pro estado final populado — sem skeleton/stagger.
 */

/** Task rows decorativas (mock, sem dados reais). */
const tarefasMock = [
  { time: "08:30", title: "Revisar proposta", duration: "30min" },
  { time: "09:15", title: "Reunião de time", duration: "45min" },
  { time: "11:00", title: "Escrever relatório", duration: "1h30" },
  { time: "14:00", title: "Deploy da build", duration: "20min" },
] as const;

/** ms que o skeleton segura antes de resolver pro conteúdo (knob). */
const SKELETON_MS = 700;

const EXPO = [0.16, 1, 0.3, 1] as const; // ease-out-expo, espelha o token do global.css

const sceneVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EXPO } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25 } },
};

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.18 } },
};
const rowVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const timeVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EXPO } },
};
const chipVariants: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EXPO } },
};

/** Uma linha real (hora · título · duração) — a hora puxa o chip via stagger interno. */
function TaskRow({ time, title, duration }: { time: string; title: string; duration: string }) {
  return (
    <motion.li variants={rowVariants} className="flex items-center gap-3">
      <motion.span
        variants={timeVariants}
        className="w-12 shrink-0 text-right font-mono text-2xs text-muted-foreground"
      >
        {time}
      </motion.span>
      <motion.div
        variants={chipVariants}
        className="flex flex-1 items-center justify-between gap-3 border-l-2 border-surface-line py-2 pl-3"
      >
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        <span className="shrink-0 rounded-full border border-surface-line px-2 py-0.5 font-mono text-2xs text-muted-foreground">
          {duration}
        </span>
      </motion.div>
    </motion.li>
  );
}

/** Uma linha de skeleton (shimmer), mesmo layout da TaskRow. */
function SkeletonRow(): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div className="skeleton h-3 w-12 shrink-0 rounded" />
      <div className="flex flex-1 items-center justify-between gap-3 border-l-2 border-surface-line py-2 pl-3">
        <div className="skeleton h-3 w-28 rounded" />
        <div className="skeleton h-4 w-10 shrink-0 rounded-full" />
      </div>
    </div>
  );
}

function SceneTarefas({ reduce }: { reduce: boolean }): JSX.Element {
  const [ready, setReady] = useState(reduce);

  useEffect(() => {
    if (reduce) return;
    const id = setTimeout(() => setReady(true), SKELETON_MS);
    return () => clearTimeout(id);
  }, [reduce]);

  return (
    <div className="relative flex flex-col gap-3">
      {/* conteúdo — define a altura (linhas ficam invisíveis até `visible`), evita jump no swap */}
      <motion.ul
        variants={listVariants}
        initial={reduce ? "visible" : "hidden"}
        animate={ready ? "visible" : "hidden"}
        className="flex flex-col gap-3"
      >
        {tarefasMock.map((t) => (
          <TaskRow key={t.time} {...t} />
        ))}
      </motion.ul>

      {/* skeleton sobreposto, some (fade) quando resolve */}
      {!reduce && (
        <AnimatePresence>
          {!ready && (
            <motion.div
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              className="absolute inset-0 flex flex-col gap-3"
            >
              {tarefasMock.map((t) => (
                <SkeletonRow key={t.time} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

/** Placeholder discreto pras cenas ainda não feitas (horários/recorrência). */
function ScenePlaceholder(): JSX.Element {
  return (
    <div className="flex flex-col gap-3 opacity-40">
      {tarefasMock.map((t) => (
        <div key={t.time} className="flex items-center gap-3">
          <div className="h-3 w-12 shrink-0 rounded bg-surface-hover" />
          <div className="flex flex-1 items-center justify-between gap-3 border-l-2 border-surface-line py-2 pl-3">
            <div className="h-3 w-24 rounded bg-surface-hover" />
            <div className="h-4 w-10 shrink-0 rounded-full bg-surface-hover" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HeroPanel({
  activeWord,
  reduce,
}: {
  activeWord: number;
  reduce: boolean;
}): JSX.Element {
  return (
    <div className="relative flex h-full w-full pt-44" aria-hidden="true">
      {/* painel principal (gradiente) — contém a cena da palavra ativa */}
      <div className="absolute top-0 left-36 h-full w-full rounded-tl-panel border-l border-l-surface-line bg-linear-150 from-surface-card to-surface-page to-55% p-8">
        <div className="w-80">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeWord}
              variants={sceneVariants}
              initial={reduce ? "visible" : "hidden"}
              animate="visible"
              exit={reduce ? undefined : "exit"}
            >
              {activeWord === 0 ? <SceneTarefas reduce={reduce} /> : <ScenePlaceholder />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* card menor flutuante — slot reservado pras "options" da task (a fazer) */}
      <div className="relative bg-surface-panel h-56 w-56 rounded-panel"></div>
    </div>
  );
}
