import { motion, useInView, useReducedMotion } from "motion/react";
import { Fragment, type ReactNode, type RefObject, useEffect, useRef } from "react";

import { duration, ease } from "@/consts/motion";

export type Wait = (ms: number) => Promise<void>;

/**
 * Roda `script` em loop enquanto `ref` está na tela. Fora da tela os timers param e o `wait`
 * pendente nunca resolve, então o script morre ali; ao voltar recomeça do topo (o script zera o
 * próprio estado). Com reduced motion não roda: devolve `true` e o card mostra o estado final.
 */
export function useScene(ref: RefObject<Element | null>, script: (wait: Wait) => Promise<void>) {
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(ref, { margin: "64px" });
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

/** Mensagem nova num chat ancorado embaixo: abre espaço (empurra as outras pra cima) e aparece. */
export function Slot({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="flex-none overflow-hidden"
      initial={reduce ? false : { height: 0 }}
      animate={{ height: "auto" }}
      transition={{ duration: duration.open, ease: ease.outQuint }}
    >
      <motion.div
        className={className}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.open, delay: duration.lag, ease: ease.outQuint }}
      >
        {/* pb: o contorno da bolha (filtro, 1px fora da caixa) não pode ser cortado pelo overflow */}
        <div className="pt-1.5 pb-1">{children}</div>
      </motion.div>
    </motion.div>
  );
}

/** Palavras entrando uma a uma (fade + rise), como texto sendo escrito. */
export function Words({ text, delay = 0 }: { text: string; delay?: number }) {
  const reduce = useReducedMotion();
  return text.split(" ").map((w, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <motion.span
        className="inline-block"
        initial={reduce ? false : { opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.word, delay: delay + i * 0.05, ease: ease.out }}
      >
        {w}
      </motion.span>
    </Fragment>
  ));
}
