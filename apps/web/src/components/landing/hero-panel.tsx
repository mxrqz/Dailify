import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import { TaskCard, type TaskCardData } from "./task-card";
import { RadialGlow, Noise } from "./panel-fx";
import { TaskOptions } from "./task-options";

/**
 * Painel animado da direita do hero. Lê `activeWord` do MESMO `useCycle` do subtítulo (via prop),
 * então a cena e a palavra crimson nunca dessincronizam. Cada palavra terá sua cena; por ora só
 * "tarefas" (0) está feita — 1/2 mostram um placeholder discreto no mesmo slot.
 *
 * `SceneTarefas` roda em 2 fases e replaya a cada reativação (a troca de `key` no `AnimatePresence`
 * remonta a cena): (A) os cards entram em stagger como skeleton, (B) resolvem 1 a 1 pro conteúdo
 * (o crossfade skeleton→conteúdo mora dentro do TaskCard). `reduce` colapsa pro estado final.
 */

/** Task cards decorativas (mock, sem dados reais). Uma linha estoura 3 tags pra mostrar os dots. */
const tarefasMock: readonly TaskCardData[] = [
  { time: "08:30", title: "Revisar proposta", duration: "30min", tags: ["design", "urgente"] },
  {
    time: "09:15",
    title: "Reunião de time",
    duration: "45min",
    tags: ["time", "sync", "q3", "roadmap", "async", "ops", "ux"],
  },
  { time: "11:00", title: "Escrever relatório", duration: "1h30", tags: ["docs"] },
  { time: "14:00", title: "Deploy da build", duration: "20min", tags: ["ci", "release", "infra"] },
] as const;

/** ms que o skeleton segura antes do 1º card resolver (knob). */
const SKELETON_MS = 600;
/** atraso entre um card resolver e o próximo (resolve de cima pra baixo). */
const RESOLVE_STAGGER_MS = 220;

const EXPO = [0.16, 1, 0.3, 1] as const; // ease-out-expo, espelha o token do global.css

const sceneVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EXPO } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25 } },
};

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EXPO } },
};

function SceneTarefas({ reduce }: { reduce: boolean }): JSX.Element {
  // nº de cards já resolvidos (de cima pra baixo); card i troca skeleton→conteúdo quando resolved > i.
  const [resolved, setResolved] = useState(reduce ? tarefasMock.length : 0);

  useEffect(() => {
    if (reduce) return;
    setResolved(0);
    const timers = tarefasMock.map((_, i) =>
      setTimeout(
        () => setResolved((n) => Math.max(n, i + 1)),
        SKELETON_MS + i * RESOLVE_STAGGER_MS,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  return (
    <motion.ul
      variants={listVariants}
      initial={reduce ? "visible" : "hidden"}
      animate="visible"
      className="flex flex-col gap-2.5"
    >
      {tarefasMock.map((t, i) => (
        <motion.li key={t.time} variants={rowVariants}>
          <TaskCard {...t} loading={i >= resolved} />
        </motion.li>
      ))}
    </motion.ul>
  );
}

/** Placeholder discreto e estático pras cenas ainda não feitas (horários/recorrência). */
function ScenePlaceholder(): JSX.Element {
  return (
    <div className="flex flex-col gap-2.5 opacity-40">
      {tarefasMock.slice(0, 3).map((t) => (
        <div key={t.time} className="flex items-start gap-3">
          <span className="w-12 shrink-0 pt-2.5 text-right font-mono text-2xs text-muted-foreground">
            {t.time}
          </span>
          <div className="min-w-0 flex-1 rounded-lg border border-surface-line px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3.5 w-28 rounded bg-surface-hover" />
              <div className="h-4.5 w-10 rounded-md bg-surface-hover" />
            </div>
            <div className="mt-2 flex gap-1.5">
              <div className="h-4.5 w-12 rounded-md bg-surface-hover" />
              <div className="h-4.5 w-10 rounded-md bg-surface-hover" />
            </div>
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
      {/* painel principal — base chapada + glow radial + noise (efeitos em ./panel-fx) */}
      <div className="absolute top-0 left-28 h-full w-full rounded-tl-panel border-l border-l-surface-line bg-surface-card mask-r-from-80% p-8 px-28">
        <RadialGlow />

        {/* mask radial casando com o RadialGlow: o grão só vive no glow (forte no canto → some em 70%) */}
        <Noise
          id="hero-noise"
          blend="soft-light"
          opacity={0.5}
          className="mask-radial-at-top-left mask-radial-from-0% mask-radial-to-70%"
        />

        <div className="relative z-10 w-full">
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

      {/* menu de ações da task (mock) — box fixo; só o conteúdo entra/sai na cena de tarefas */}
      <TaskOptions active={activeWord === 0} reduce={reduce} />
    </div>
  );
}
