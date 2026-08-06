import { motion, useReducedMotion } from "framer-motion";

/**
 * Ambient film-grain overlay for the landing page — "the day breathing".
 *
 * The feTurbulence noise is rendered once (SVG filters are not re-run per animation frame);
 * the slow "breathe/drift" is a cheap CSS transform animation on top of the static noise.
 * Monochrome/neutral (feColorMatrix desaturates the turbulence), low opacity, non-interactive.
 * Respects prefers-reduced-motion: renders fully static, no drift, when reduced motion is on.
 */
export function Grain(): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <motion.div
        className="absolute inset-[-10%] opacity-5 mix-blend-overlay"
        animate={reduce ? undefined : { x: ["0%", "-2%", "0%"], y: ["0%", "1.5%", "0%"] }}
        transition={{ duration: 18, ease: "easeInOut", repeat: Infinity }}
      >
        <svg width="100%" height="100%" preserveAspectRatio="none">
          <filter id="grain-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.8"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-noise)" />
        </svg>
      </motion.div>
    </div>
  );
}
