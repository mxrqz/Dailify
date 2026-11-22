import { startTransition, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { Routes, useLocation, type Location } from "react-router-dom";

import { useEffectEvent } from "@/hooks/useEffectEvent";

/**
 * `<Routes>` whose page changes cross-fade through the View Transitions API (`::view-transition-*`
 * in global.css). BrowserRouter drops `viewTransition`, so this holds the shown location and swaps
 * it inside `startViewTransition`. A query change (`?view=calendar`) swaps in place, as does
 * everything under reduced motion or without the API.
 */
export function TransitionRoutes({ children }: { children: ReactNode }): JSX.Element {
  const location = useLocation();
  const [shown, setShown] = useState(location);
  const reduce = useReducedMotion();
  // Resolves the transition's update once the new page committed: a lazy page suspends in the
  // router's transition, and the old screen stays until it's ready.
  const landed = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    landed.current?.();
    landed.current = null;
  }, [shown]);

  const go = useEffectEvent((next: Location) => {
    if (next === shown) return;
    if (next.pathname === shown.pathname || reduce || !("startViewTransition" in document))
      return setShown(next);
    const transition = document.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          // A newer navigation skips this one: let its update finish instead of timing out.
          landed.current?.();
          landed.current = resolve;
          startTransition(() => setShown(next));
        }),
    );
    // Skipped by a newer one, `ready` rejects; that's not an error.
    transition.ready.catch(() => {});
  });
  useLayoutEffect(() => go(location), [location]);

  return <Routes location={shown}>{children}</Routes>;
}
