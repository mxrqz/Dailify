import { AnimatePresence, motion, type Variants } from "framer-motion";

import { RadialGlow, Noise } from "./panel-fx";
import { TaskOptions } from "./task-options";
import { SceneTarefas } from "./scenes/scene-tarefas";
import { SceneHorarios } from "./scenes/scene-horarios";
import { SceneRecorrencia } from "./scenes/scene-recorrencia";

/**
 * Painel animado da direita do hero. Lê `activeWord` do MESMO `useCycle` do subtítulo (via prop),
 * então a cena e a palavra crimson nunca dessincronizam. Cada palavra tem sua cena (em ./scenes):
 * tarefas (0), horários (1), recorrência (2). A troca de `key` no AnimatePresence remonta a cena a
 * cada reativação, então cada uma replaya sua entrada. `reduce` congela no estado estático.
 */

const EXPO = [0.16, 1, 0.3, 1] as const; // ease-out-expo, espelha o token do global.css

const sceneVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EXPO } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.25 } },
};

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
              {activeWord === 0 ? (
                <SceneTarefas reduce={reduce} />
              ) : activeWord === 1 ? (
                <SceneHorarios reduce={reduce} />
              ) : (
                <SceneRecorrencia reduce={reduce} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* menu de ações da task (mock) — box fixo; só o conteúdo entra/sai na cena de tarefas */}
      <TaskOptions activeWord={activeWord} reduce={reduce} />
    </div>
  );
}
