import type { Transition } from "motion/react";

// Espelham --motion-duration-* e --motion-ease-* de global.css (motion.test.ts garante). Segundos, como o motion usa.
export const duration = {
  instant: 0,
  fast: 0.12,
  base: 0.2,
  slow: 0.3,
  open: 0.46,
  word: 0.24,
  stagger: 0.038,
  lag: 0.08,
} as const;

export const ease = {
  out: [0.23, 1, 0.32, 1],
  standard: [0.2, 0, 0, 1],
  exit: [0.3, 0, 1, 1],
  outExpo: [0.16, 1, 0.3, 1],
  outQuint: [0.22, 1, 0.36, 1],
  outSoft: [0.2, 0.7, 0.2, 1],
} as const;

// Sem bounce em UI do app. `soft` é o morph aprovado do composer.
export const spring = {
  soft: { type: "spring", visualDuration: 0.24, bounce: 0 },
  snappy: { type: "spring", visualDuration: 0.2, bounce: 0 },
} as const satisfies Record<string, Transition>;

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: duration.base, ease: ease.out },
} as const;

// A morphing surface takes its radius through `style` (motion corrects it only there), in px.
export const radius = { panel: 22 } as const;
