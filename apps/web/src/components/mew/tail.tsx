import { forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * A setinha do balão, embaixo e no meio. `offsetX` (px) a desloca pra seguir a Mew; pra seguir
 * a cada frame sem re-render, escreva `ref.current.style.translate` direto (ver `Mew.onHeadMove`).
 */
export const Tail = forwardRef<SVGSVGElement, { offsetX?: number; className?: string }>(
  function Tail({ offsetX = 0, className }, ref) {
    return (
      <svg
        ref={ref}
        viewBox="0 0 30 13"
        aria-hidden="true"
        className={cn(
          "absolute -bottom-3 left-1/2 -ml-3.75 h-3.25 w-7.5 fill-surface-raised",
          className,
        )}
        style={{ translate: `${offsetX}px 0` }}
      >
        <path d="M0 0Q6.5 0 9.5 4.2L12.6 8.6Q15 11.8 17.4 8.6L20.5 4.2Q23.5 0 30 0Z" />
      </svg>
    );
  },
);
