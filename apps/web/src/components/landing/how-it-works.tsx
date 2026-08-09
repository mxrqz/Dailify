import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

import { copy } from "./copy";

/**
 * "Como funciona" — 3-step timeline (T8). Heading (eyebrow + h2) + steps de `copy.howItWorks`.
 * No desktop cada passo é um NÓ numerado (chip mono `01/02/03`, `bg-surface-card` sólido) sentado
 * sobre uma linha `bg-border` chip-a-chip — o motivo "linha do tempo" deitado — com um ponto crimson
 * que percorre a linha conforme a seção passa pela viewport (`useScroll` + `useTransform` mapeando o
 * progresso do scroll pra posição `left` do ponto). `useReducedMotion()` estaciona o ponto no fim.
 * Linha/ponto são decoração só-desktop; no mobile os 3 passos empilham centralizados (sem linha).
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
      <div className="mx-auto mb-14 flex max-w-2xl flex-col items-center gap-4 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-accent-primary">
          {copy.howItWorks.eyebrow}
        </p>
        <h2 className="text-balance text-2xl font-semibold tracking-[-0.02em] text-foreground md:text-3xl">
          {copy.howItWorks.title}
        </h2>
      </div>

      <div ref={sectionRef} className="relative">
        {/* Linha chip-a-chip (centros das colunas 1 e 3 = 1/6 e 5/6) com o ponto que percorre o scroll */}
        <div
          className="absolute left-[16.666%] right-[16.666%] top-6 hidden h-px bg-border md:block"
          aria-hidden="true"
        >
          <motion.span
            className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-accent-primary shadow-[0_0_12px_var(--accent-glow)]"
            style={{ left: reduce ? "100%" : pointLeft, x: "-50%" }}
          />
        </div>

        <ol className="relative grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          {copy.howItWorks.steps.map((item) => (
            <li key={item.step} className="flex flex-col items-center gap-3 text-center">
              <span className="relative z-10 flex size-12 items-center justify-center rounded-full border bg-surface-card font-mono text-sm text-accent-primary">
                {item.step}
              </span>
              <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
                {item.title}
              </h3>
              <p className="max-w-xs text-sm text-content-secondary">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
