import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import { TaskCard, type TaskCardData } from "../task-card";
import { Checklist } from "../checklist";

/**
 * Cena "tarefas" (activeWord===0). Duas fases, como a recorrência: (A) intro ~INTRO_MS = o ícone
 * <Checklist> animado no centro; (B) resolve pra lista — os cards entram em stagger como skeleton e
 * resolvem 1 a 1 (o crossfade skeleton→conteúdo mora no TaskCard). O 1º card entra `selected` (é a
 * task que o menu de ações referencia). `reduce` vai direto pra lista, sem intro nem skeleton.
 */

const INTRO_MS = 1600; // duração da Fase A (ícone) antes de resolver
const SKELETON_MS = 600; // ms que o skeleton segura antes do 1º card resolver
const RESOLVE_STAGGER_MS = 220; // atraso entre um card resolver e o próximo
const EXPO = [0.16, 1, 0.3, 1] as const;

/** Task cards decorativas (mock). Uma linha estoura 3 tags pra mostrar os dots. */
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

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EXPO } },
};

/** Fase B: a lista com skeleton→resolve. */
function TaskList({ reduce }: { reduce: boolean }): JSX.Element {
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
          <TaskCard {...t} selected={i === 0} loading={i >= resolved} />
        </motion.li>
      ))}
    </motion.ul>
  );
}

export function SceneTarefas({ reduce }: { reduce: boolean }): JSX.Element {
  // fase: 'intro' (ícone/skeleton) → 'list' (conteúdo). reduce vai direto pra lista.
  const [phase, setPhase] = useState<"intro" | "list">(reduce ? "list" : "intro");

  useEffect(() => {
    if (reduce) return;
    setPhase("intro");
    const t = setTimeout(() => setPhase("list"), INTRO_MS);
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
            <Checklist size={120} animated={!reduce} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: EXPO }}
          >
            <TaskList reduce={reduce} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
