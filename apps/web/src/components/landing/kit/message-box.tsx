import { animate, motionValue, useReducedMotion } from "motion/react";
import {
  Fragment,
  type Key,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { spring } from "@/consts/motion";
import { cn } from "@/lib/utils";

import { Ears } from "./ears";

export type MessageType = "status" | "draft" | "done" | "text";

type MessageBoxProps = {
  type: MessageType;
  children: ReactNode;
  ears?: boolean;
  /** Troca o conteúdo com o morph mesmo sem mudar de `type` (ex.: outro rascunho). */
  contentKey?: Key;
  className?: string;
};

const OUT_MS = 120;

/**
 * Uma mensagem da Mewki = um container só: quando `type`/`contentKey` muda, o conteúdo velho some,
 * o novo entra com fade + translate, e a altura do container segue o conteúdo numa mola (a largura
 * troca sem animar). Em repouso a altura é `auto`: nada prende o conteúdo.
 */
export function MessageBox({
  type,
  children,
  ears = true,
  contentKey,
  className,
}: MessageBoxProps) {
  const reduce = useReducedMotion();
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const latest = useRef(children);
  const swapped = useRef(false);
  const [shown, setShown] = useState({ type, key: contentKey, node: children });
  const changed = shown.type !== type || shown.key !== contentKey;

  useEffect(() => {
    latest.current = children;
  });

  useEffect(() => {
    if (!changed) return;
    const swap = () => {
      swapped.current = true;
      setShown({ type, key: contentKey, node: latest.current });
    };
    if (reduce || !innerRef.current) return swap();
    const a = innerRef.current.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: OUT_MS,
      fill: "forwards",
    });
    const t = window.setTimeout(swap, OUT_MS);
    return () => {
      clearTimeout(t);
      a.cancel();
    };
  }, [changed, type, contentKey, reduce]);

  // depois da troca o conteúdo novo entra (sem blur: filtro aqui refiltrava a bolha a cada quadro)
  useLayoutEffect(() => {
    if (!swapped.current) return;
    swapped.current = false;
    innerRef.current?.animate(
      [
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 300, easing: "ease-out" },
    );
  }, [shown]);

  // A altura segue o conteúdo: px só enquanto a mola anda, `auto` quando assenta.
  useEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (reduce || !box || !inner) return;
    let last = inner.offsetHeight;
    const height = motionValue(last);
    const off = height.on("change", (h) => {
      box.style.height = `${h}px`;
    });
    const observer = new ResizeObserver(() => {
      const next = inner.offsetHeight;
      if (Math.abs(next - last) < 2) return;
      // parada, a caixa já pulou pro tamanho novo: volta pro velho e anda; andando, segue com a velocidade
      if (!height.isAnimating()) height.jump(last);
      last = next;
      animate(height, next, {
        ...spring.soft,
        onComplete: () => {
          box.style.height = "";
        },
      });
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      off();
      height.stop();
      box.style.height = "";
    };
  }, [reduce]);

  const shownType = changed ? shown.type : type;
  return (
    // O contorno é a sombra do wrapper, por baixo das orelhas (que têm o próprio traço) e do corpo.
    <div
      className={cn(
        "relative min-w-0 rounded-lg rounded-bl-xs shadow-line",
        ears && "mt-3.5",
        className,
      )}
    >
      {ears && <Ears size="sm" line />}
      <div
        ref={boxRef}
        data-slot="message-box"
        className="relative overflow-hidden rounded-lg rounded-bl-xs bg-surface-raised"
      >
        <div
          ref={innerRef}
          className={cn("px-3.5 py-3", (shownType === "draft" || shownType === "done") && "w-69")}
        >
          <Fragment key={`${shown.type}:${String(shown.key)}`}>
            {changed ? shown.node : children}
          </Fragment>
        </div>
      </div>
    </div>
  );
}
