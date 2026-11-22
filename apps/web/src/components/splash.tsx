import { useAnimate, usePresence, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

import { copy } from "@/components/dashboard/copy";
import { Mew } from "@/components/mew/mew";
import { duration, ease } from "@/consts/motion";

/** Piso do splash: menos que isso parece um piscar, mesmo com os dados já em mãos. */
export const SPLASH_MIN_MS = 1500;

/**
 * Abertura do app enquanto o `ProtectedRoute` carrega: a Mew caçando o pontinho de laser, no
 * centro. Ao sair (é filho de um `AnimatePresence`) a Mew voa até a do dock do mobile; sem dock
 * ou com movimento reduzido, fade.
 */
export function Splash(): JSX.Element {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const mew = useRef<HTMLDivElement>(null);
  const [isPresent, safeToRemove] = usePresence();
  const reduce = useReducedMotion();

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
        {/* With the Mew from the start: shown late, it landed on top of the exit flight. */}
        <p
          data-splash-fade
          role="status"
          className="min-h-5 text-subhead font-medium text-ink-secondary transition-opacity duration-slow starting:opacity-0"
        >
          {copy.loading.slow}
        </p>
      </div>
    </div>
  );
}
