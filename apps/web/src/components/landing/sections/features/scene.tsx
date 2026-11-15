import { motion, useReducedMotion } from "motion/react";
import { Fragment, type ReactNode, type RefObject, useEffect, useRef } from "react";

import { useInView } from "@/components/landing/kit/use-in-view";

export type Wait = (ms: number) => Promise<void>;

/**
 * Roda `script` em loop enquanto `ref` está na tela. Fora da tela os timers param e o `wait`
 * pendente nunca resolve, então o script morre ali; ao voltar recomeça do topo (o script zera o
 * próprio estado). Com reduced motion não roda: devolve `true` e o card mostra o estado final.
 */
export function useScene(ref: RefObject<Element | null>, script: (wait: Wait) => Promise<void>) {
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(ref);
  const live = useRef(script);

  useEffect(() => {
    live.current = script;
  });

  useEffect(() => {
    if (!inView || reduce) return;
    const timers = new Set<number>();
    const wait: Wait = (ms) =>
      new Promise((res) => {
        const t = window.setTimeout(() => {
          timers.delete(t);
          res();
        }, ms);
        timers.add(t);
      });
    void (async () => {
      for (;;) await live.current(wait);
    })();
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [inView, reduce]);

  return reduce;
}

const OUT = [0.22, 1, 0.36, 1] as const;

/** Mensagem nova num chat ancorado embaixo: abre espaço (empurra as outras pra cima) e aparece. */
export function Slot({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex-none overflow-hidden"
      initial={reduce ? false : { height: 0 }}
      animate={{ height: "auto" }}
      transition={{ duration: 0.46, ease: OUT }}
    >
      <motion.div
        className={className}
        initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.5, delay: 0.08, ease: OUT }}
      >
        {/* pb: o contorno da bolha (filtro, 1px fora da caixa) não pode ser cortado pelo overflow */}
        <div className="pt-1.5 pb-1">{children}</div>
      </motion.div>
    </motion.div>
  );
}

/** Palavras entrando uma a uma (fade + blur), como texto sendo escrito. */
export function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduce = useReducedMotion();
  return text.split(" ").map((w, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <motion.span
        className="inline-block"
        initial={reduce ? false : { opacity: 0, y: 3, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.38, delay: delay + i * 0.05, ease: [0.2, 0.7, 0.2, 1] }}
      >
        {w}
      </motion.span>
    </Fragment>
  ));
}
