import { motion, useReducedMotion, type Variants } from "framer-motion";

import { cn } from "@/lib/utils";
import {
  SceneDuration,
  SceneFree,
  ScenePriority,
  SceneComplete,
  SceneBrowser,
  SceneReminders,
} from "./scenes";
import { copy } from "./copy";
import { Grain } from "./grain";
import { useRibbonGeometry } from "./ribbon-path";

type BentoKey = keyof typeof copy.bento;

/**
 * One bento cell: which concept scene illustrates it, keyed to `copy.bento`, and whether it's `wide`
 * (spans 2 of 3 columns). These six are the execution DETAILS — deliberately NOT the core views the
 * hero/tabs already show. The three wide cells (duration / complete / browser) are the ones the
 * ribbon connects. Order here drives both the DOM/mobile stack order and the desktop grid flow.
 */
const CELLS: ReadonlyArray<{
  key: BentoKey;
  Scene: (props: { className?: string }) => JSX.Element;
  wide?: boolean;
}> = [
  { key: "duracao", Scene: SceneDuration, wide: true },
  { key: "comeceGratis", Scene: SceneFree },
  { key: "priority", Scene: ScenePriority },
  { key: "concluido", Scene: SceneComplete, wide: true },
  { key: "navegador", Scene: SceneBrowser, wide: true },
  { key: "reminders", Scene: SceneReminders },
];

/**
 * Feature bento — six execution-detail scenes in a 3-column zigzag: each row pairs one `wide` cell
 * (spans 2 columns) with one square cell, alternating side to side (duração+grátis /
 * prioridade+concluído / navegador+lembretes). The three wide cells overlap in the middle column, so a
 * single computed SVG outline (`ribbon-path.ts`) connects them into one surface — fill via
 * `clip-path`, border via a stroked `<path>` — joined by concave necks that bridge the row gaps
 * (the tabs shell trick). At `md`+ the wide cells go transparent and let that ribbon show through.
 * On mobile the ribbon is dropped and every cell is a plain
 * stacked card. Scene boxes are a fixed height (`h-44`) so the section stays compact.
 *
 * Reveal: the grid fades/slides its cells in on scroll (`whileInView`, `staggerChildren`).
 * `useReducedMotion()` drops the stagger/delay so every cell renders in its final place instantly.
 */
export function FeatureBento(): JSX.Element {
  const reduce = useReducedMotion();
  const { ref, geom } = useRibbonGeometry();

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
    <section className="px-gutter section-y">
      <motion.div
        ref={ref}
        variants={containerVariants}
        initial={reduce ? "visible" : "hidden"}
        whileInView="visible"
        viewport={{ once: true }}
        className="relative grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5"
      >
        {geom && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 hidden md:block"
          >
            <div
              className="absolute inset-0 bg-surface-card"
              style={{ clipPath: `path('${geom.d}')` }}
            >
              <Grain preset="eclipse" speed={0} opacity={0.2} />
            </div>
            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox={`0 0 ${geom.w} ${geom.h}`}
            >
              <path
                d={geom.d}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        )}

        {CELLS.map(({ key, Scene, wide }) => {
          const cellCopy = copy.bento[key];
          return (
            <motion.div
              key={key}
              variants={cellVariants}
              data-ribbon-cell={wide ? "" : undefined}
              className={cn(
                "relative z-10 flex flex-col gap-4 rounded-panel border bg-surface-card p-5",
                wide && "md:col-span-2 md:border-transparent md:bg-transparent",
              )}
            >
              <div className="relative h-44 overflow-hidden rounded-lg">
                <Scene className="h-full w-full" />
              </div>
              <div className="relative flex flex-col gap-1">
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
