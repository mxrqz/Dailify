import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Bell, CheckCircle, Edit, Repeat, Trash2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Menu de ações de uma task (o "⋮" da linha) — card flutuante decorativo ao lado da lista. O
 * container (box) fica SEMPRE visível (slot fixo); só o CONTEÚDO entra/sai conforme a cena, via
 * `AnimatePresence` interno em `active` (mesmo `useCycle` do hero). Entra com fade e os itens em
 * stagger top→bottom (index+1, sem skeleton). `reduce` colapsa pro estado final. Mock, sem interação.
 */
const OPTIONS: { icon: LucideIcon; label: string; danger?: boolean }[] = [
  { icon: CheckCircle, label: "Concluir" },
  { icon: Edit, label: "Editar" },
  { icon: Bell, label: "Lembrete" },
  { icon: Repeat, label: "Recorrência" },
  { icon: Trash2, label: "Excluir", danger: true },
];

const EXPO = [0.16, 1, 0.3, 1] as const;

const contentVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EXPO } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.2, ease: EXPO } },
};
const listVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: EXPO } },
};

export function TaskOptions({ active, reduce }: { active: boolean; reduce: boolean }): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-56 w-56 flex-col rounded-panel border border-surface-line bg-surface-panel p-2 shadow-panel"
    >
      <AnimatePresence>
        {active && (
          <motion.div
            key="content"
            variants={contentVariants}
            initial={reduce ? false : "hidden"}
            animate="visible"
            exit={reduce ? undefined : "exit"}
            className="flex flex-1 flex-col"
          >
            <div className="px-2 pb-2 pt-1">
              <p className="truncate text-sm font-medium text-foreground">Revisar proposta</p>
              <p className="font-mono text-2xs text-muted-foreground">08:30 · 30min</p>
            </div>

            <div className="h-px bg-surface-line" />

            <motion.ul variants={listVariants} className="mt-1 flex flex-col gap-0.5">
              {OPTIONS.map(({ icon: Icon, label, danger }, i) => (
                <motion.li
                  key={label}
                  variants={itemVariants}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-xs",
                    i === 0 && "bg-surface-hover text-foreground",
                    i !== 0 && !danger && "text-content-secondary",
                    danger && "text-destructive",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </motion.li>
              ))}
            </motion.ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
