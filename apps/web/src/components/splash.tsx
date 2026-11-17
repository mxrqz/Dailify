import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { copy } from "@/components/dashboard/copy";
import { Mew } from "@/components/mew/mew";
import { duration, ease } from "@/consts/motion";

/** Piso do splash: o pulinho de entrada da Mew. Sair antes disso é só um piscar. */
export const SPLASH_MIN_MS = 700;
/** A legenda só aparece se a carga demorar: antes disso a Mew caçando o laser já basta. */
const SLOW_AFTER_MS = 2000;

/**
 * Abertura do app enquanto o `ProtectedRoute` carrega: a Mew caçando o pontinho de laser, no
 * centro. Sai com fade (é filho de um `AnimatePresence`); `slow` força a legenda (preview).
 */
export function Splash({ slow: forceSlow = false }: { slow?: boolean }): JSX.Element {
  const [slow, setSlow] = useState(forceSlow);

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: duration.slow, ease: ease.exit }}
      className="fixed inset-0 z-50 grid place-items-center bg-canvas"
    >
      <div className="flex flex-col items-center gap-10">
        <Mew mood="loading" enter className="w-42" />
        <motion.p
          role="status"
          initial={false}
          animate={slow ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: duration.slow, ease: ease.out }}
          className="min-h-5 text-subhead font-medium text-ink-secondary"
        >
          {/* o texto só entra com o `slow`: invisível no `status`, o leitor de tela anunciaria já */}
          {slow && copy.loading.slow}
        </motion.p>
      </div>
    </motion.div>
  );
}
