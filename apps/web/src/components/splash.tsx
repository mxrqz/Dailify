import { motion, useAnimate, usePresence, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { copy } from "@/components/dashboard/copy";
import { Mew } from "@/components/mew/mew";
import { duration, ease } from "@/consts/motion";

/** Piso do splash: menos que isso parece um piscar, mesmo com os dados já em mãos. */
export const SPLASH_MIN_MS = 1500;
/** A legenda só aparece se a carga demorar: antes disso a Mew caçando o laser já basta. */
const SLOW_AFTER_MS = 2000;

/**
 * Abertura do app enquanto o `ProtectedRoute` carrega: a Mew caçando o pontinho de laser, no
 * centro. Ao sair (é filho de um `AnimatePresence`) a Mew voa até a do dock do mobile; sem dock
 * ou com movimento reduzido, fade. `slow` força a legenda (preview).
 */
export function Splash({ slow: forceSlow = false }: { slow?: boolean }): JSX.Element {
  const [slow, setSlow] = useState(forceSlow);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const mew = useRef<HTMLDivElement>(null);
  const [isPresent, safeToRemove] = usePresence();
  const reduce = useReducedMotion();

  useEffect(() => {
    const id = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (isPresent || !mew.current) return;
    // The route mounts in the same commit the splash starts leaving, so the dock is measurable.
    // The first-run intro covers the dock, so its welcome Mew is the landing spot then.
    const to = (
      document.querySelector('[data-slot="onboarding"] .mew') ??
      document.querySelector('[data-slot="create-dock"] .mew')
    )?.getBoundingClientRect();
    const from = mew.current.getBoundingClientRect();
    const fade = { duration: duration.slow, ease: ease.exit };
    const exit =
      reduce || !to?.width || !from.width
        ? animate(scope.current, { opacity: 0 }, fade)
        : Promise.all([
            animate(
              mew.current,
              {
                x: to.left + to.width / 2 - (from.left + from.width / 2),
                y: to.top + to.height / 2 - (from.top + from.height / 2),
                scale: to.width / from.width,
              },
              { duration: duration.open, ease: ease.outQuint },
            ),
            animate("[data-splash-fade]", { opacity: 0 }, fade),
          ]);
    void exit.then(safeToRemove);
  }, [isPresent, safeToRemove, reduce, animate, scope]);

  return (
    <div ref={scope} className="fixed inset-0 z-overlay grid place-items-center">
      {/* The backdrop fades on its own so the flying Mew stays opaque over the dashboard. */}
      <div data-splash-fade className="absolute inset-0 bg-canvas" />
      <div className="relative flex flex-col items-center gap-10">
        <div ref={mew}>
          <Mew mood="loading" enter className="w-42" />
        </div>
        <motion.p
          data-splash-fade
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
    </div>
  );
}
