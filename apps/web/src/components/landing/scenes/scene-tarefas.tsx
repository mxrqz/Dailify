import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";

import { TaskCard, type TaskCardData } from "../task-card";

/**
 * Cena "tarefas" (activeWord===0). Roda em 2 fases e replaya a cada reativação (a troca de `key` no
 * AnimatePresence do painel remonta a cena): (A) os cards entram em stagger como skeleton, (B)
 * resolvem 1 a 1 pro conteúdo (o crossfade skeleton→conteúdo mora dentro do TaskCard). O 1º card
 * entra `selected` (é a task que o menu de ações referencia). `reduce` colapsa pro estado final.
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

const EXPO = [0.16, 1, 0.3, 1] as const; // ease-out-expo

const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};
const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EXPO } },
};

export function SceneTarefas({ reduce }: { reduce: boolean }): JSX.Element {
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
