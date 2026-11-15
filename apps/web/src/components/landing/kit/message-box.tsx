import { useReducedMotion } from "motion/react";
import { type Key, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { BUBBLE_LINE } from "./bubble";
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

const EASE = "cubic-bezier(0.32,0.72,0,1)";
const OUT_MS = 120;

/**
 * Uma mensagem da Mewki = um container só: quando `type`/`contentKey` muda, o conteúdo velho some,
 * o container anima até o tamanho do novo e o novo entra com fade + blur.
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
  const from = useRef<DOMRect | null>(null);
  const [shown, setShown] = useState({ type, key: contentKey, node: children });
  const changed = shown.type !== type || shown.key !== contentKey;

  useEffect(() => {
    latest.current = children;
  });

  useEffect(() => {
    if (!changed) return;
    const swap = () => setShown({ type, key: contentKey, node: latest.current });
    if (reduce || !innerRef.current) return swap();
    from.current = boxRef.current?.getBoundingClientRect() ?? null;
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

  // depois da troca: container do tamanho velho pro novo, conteúdo novo entra
  useLayoutEffect(() => {
    const r0 = from.current;
    const box = boxRef.current;
    from.current = null;
    if (!r0 || !box || !r0.width) return;
    const r1 = box.getBoundingClientRect();
    box.animate(
      [
        { width: `${r0.width}px`, height: `${r0.height}px` },
        { width: `${r1.width}px`, height: `${r1.height}px` },
      ],
      { duration: 520, easing: EASE },
    );
    innerRef.current?.animate(
      [
        { opacity: 0, filter: "blur(4px)", transform: "translateY(4px)" },
        { opacity: 1, filter: "blur(0)", transform: "none" },
      ],
      { duration: 380, delay: 120, easing: "ease-out", fill: "backwards" },
    );
  }, [shown]);

  const shownType = changed ? shown.type : type;
  return (
    <div
      className={cn("relative min-w-0", ears && "mt-3.5", className)}
      style={{ filter: BUBBLE_LINE }}
    >
      {ears && <Ears size="sm" />}
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-lg rounded-bl-xs bg-surface-raised"
      >
        <div
          ref={innerRef}
          key={`${shown.type}:${String(shown.key)}`}
          className={cn("px-3.5 py-3", (shownType === "draft" || shownType === "done") && "w-69")}
        >
          {changed ? shown.node : children}
        </div>
      </div>
    </div>
  );
}
