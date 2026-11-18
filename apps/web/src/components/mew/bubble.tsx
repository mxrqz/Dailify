import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Ears } from "./ears";
import { Tail } from "./tail";

// contorno 1px na silhueta inteira (balão + orelhas + setinha) e sombra que segue a mesma silhueta;
// `box-shadow`/`border` desenhariam só o retângulo
export const BUBBLE_FILTER = "url(#bubLine) drop-shadow(0 6px 14px #0000001a)";

/** Define o filtro `#bubLine` — renderize uma vez por página, antes de qualquer `Bubble`. */
export function BubbleDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <filter id="bubLine" x="-5%" y="-10%" width="110%" height="130%">
        <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="d" />
        <feFlood floodColor="currentColor" className="text-separator" />
        <feComposite in2="d" operator="in" result="r" />
        <feMerge>
          <feMergeNode in="r" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </svg>
  );
}

type BubbleProps = {
  children: ReactNode;
  className?: string;
  ears?: boolean;
  flick?: "left" | "right" | false;
  tail?: boolean;
  tailOffsetX?: number;
};

export function Bubble({
  children,
  className,
  ears = true,
  flick,
  tail,
  tailOffsetX,
}: BubbleProps) {
  return (
    <div
      className={cn(
        "relative rounded-lg bg-surface-raised px-4 py-3.5",
        ears && "mt-4.25",
        className,
      )}
      style={{ filter: BUBBLE_FILTER }}
    >
      {ears && <Ears flick={flick} />}
      {tail && <Tail offsetX={tailOffsetX} />}
      {children}
    </div>
  );
}
