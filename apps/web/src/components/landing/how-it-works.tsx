import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { copy } from "./copy";

/**
 * "Como funciona" — 3-step timeline (T8). Steps come from `copy.howItWorks.steps` (`[01]/[02]/[03]`
 * mono numbers, per the design doc's "linha do tempo" motif). On desktop the steps sit under a
 * horizontal `bg-border` line — the day-timeline motif laid flat — with a crimson point that
 * travels the line as the section scrolls through the viewport (`useScroll` + `useTransform`
 * mapping scroll progress to the point's `left` position). `useReducedMotion()` parks the point at
 * the end of the line instead of tying it to scroll. The line/point are desktop-only decoration;
 * mobile just stacks the 3 steps (no line — keeps the layout clean at that width).
 */
export function HowItWorks(): JSX.Element {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const pointLeft = useTransform(scrollYProgress, [0.1, 0.9], ["0%", "100%"]);

  return (
    <section className="px-gutter py-20 md:py-28">
      <div ref={sectionRef} className="relative">
        <div className="absolute inset-x-0 top-6 hidden h-px bg-border md:block" aria-hidden="true">
          <motion.span
            className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-accent-primary shadow-[0_0_12px_var(--accent-glow)]"
            style={{ left: reduce ? "100%" : pointLeft, x: "-50%" }}
          />
        </div>

        <ol className="relative grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {copy.howItWorks.steps.map((item) => (
            <li key={item.step} className="flex flex-col gap-3">
              <span className="font-mono text-sm text-accent-primary">[{item.step}]</span>
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                {item.title}
              </h3>
              <p className="text-sm text-content-secondary">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
