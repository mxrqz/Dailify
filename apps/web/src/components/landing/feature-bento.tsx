import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import {
  SceneCalendar,
  SceneHours,
  ScenePriority,
  SceneRecurrence,
  SceneVoice,
  SceneReminders,
} from "./scenes";
import { copy } from "./copy";

type BentoKey = keyof typeof copy.bento;

/**
 * One bento cell: which TIME scene (T6) illustrates it, keyed to `copy.bento` (T3), and whether
 * it's the Voice hero cell. Order here drives both the DOM/mobile stack order and the desktop
 * grid flow below.
 */
const CELLS: ReadonlyArray<{
  key: BentoKey;
  Scene: (props: { className?: string }) => JSX.Element;
  hero?: boolean;
}> = [
  { key: "calendar", Scene: SceneCalendar },
  { key: "timeSlots", Scene: SceneHours },
  { key: "priority", Scene: ScenePriority },
  { key: "recurrence", Scene: SceneRecurrence },
  { key: "voice", Scene: SceneVoice, hero: true },
  { key: "reminders", Scene: SceneReminders },
];

/**
 * Feature bento — the six TIME concept scenes (T6) assembled into an asymmetric CSS grid. On a
 * 4-column desktop track, the first four cells (calendar/hours/priority/recurrence) fill row one
 * as uniform squares; Voice then spans 2 columns on row two — matching `SceneVoice`'s 2:1 viewBox
 * so it never letterboxes — with reminders alongside it. Voice is the only cell tinted
 * `bg-accent-subtle`; every other cell is neutral `bg-surface-card`. Collapses to a single
 * stacked column on mobile (each scene full-width, Voice included).
 *
 * Reveal: the grid fades/slides its cells in on scroll (`whileInView`, `staggerChildren`).
 * `useReducedMotion()` drops the stagger/delay so every cell renders in its final place instantly.
 */
export function FeatureBento(): JSX.Element {
  const reduce = useReducedMotion();

  const containerVariants: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: reduce ? 0 : 0.05 },
    },
  };
  const cellVariants: Variants = {
    hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 16 },
    visible: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.5, ease: "easeOut" } },
  };

  return (
    <section className="px-[clamp(1rem,5vw,24rem)] py-20 md:py-28">
      <motion.div
        variants={containerVariants}
        initial={reduce ? "visible" : "hidden"}
        whileInView="visible"
        viewport={{ once: true }}
        className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-5"
      >
        {CELLS.map(({ key, Scene, hero }) => {
          const cellCopy = copy.bento[key];
          return (
            <motion.div
              key={key}
              variants={cellVariants}
              className={cn(
                "flex flex-col gap-4 rounded-xl border p-5",
                hero ? "bg-accent-subtle md:col-span-2" : "bg-surface-card",
              )}
            >
              <div
                className={cn(
                  "overflow-hidden rounded-lg",
                  hero ? "aspect-[2/1]" : "aspect-square",
                )}
              >
                <Scene className="h-full w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                  {cellCopy.title}
                </h3>
                <p className="text-sm text-content-secondary">{cellCopy.description}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
