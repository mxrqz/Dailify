import type { Transition } from "motion/react";

// Espelham --motion-duration-* e --motion-ease-* de global.css (motion.test.ts garante). Segundos, como o motion usa.
export const duration = { instant: 0, fast: 0.12, base: 0.2, slow: 0.3 } as const;

export const ease = {
  out: [0.23, 1, 0.32, 1],
  standard: [0.2, 0, 0, 1],
  exit: [0.3, 0, 1, 1],
  outExpo: [0.16, 1, 0.3, 1],
  outQuint: [0.22, 1, 0.36, 1],
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

/** Conteúdo que aparece depois de um morph: espera a superfície tomar forma. */
export const reveal = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.14, delay: 0.06 } },
} as const;

/** Variants para AnimatePresence custom={dir}: entra pelo lado de dir e sai pelo oposto. */
export const slideX = (dir: 1 | -1, distance = 24) => ({
  enter: { x: dir * distance, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -dir * distance, opacity: 0 },
});

export const collapse = {
  exit: { opacity: 0, height: 0 },
  transition: { duration: duration.base, ease: ease.exit },
} as const;
