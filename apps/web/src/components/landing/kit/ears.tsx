import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

type Side = "left" | "right";

// a batidinha de vez em quando: parada 86% do ciclo, depois sobe, volta e assenta
const FLICK = [14, 14, 30, 8, 19, 13, 14];
const FLICK_AT = [0, 0.86, 0.89, 0.92, 0.95, 0.98, 1];

const SIZES = {
  md: { box: "-top-4.25 h-6 w-9", l: "left-0.75", r: "right-0.75" },
  sm: { box: "-top-3.75 h-4.25 w-6.5", l: "left-0.5", r: "right-0.5" },
};

/** As duas orelhas do balão, inclinadas ±14°, na cor do balão (`surface-raised`). */
export function Ears({
  flick = false,
  size = "md",
}: {
  flick?: Side | false;
  size?: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  return (
    <>
      <Ear side="left" flick={flick === "left"} className={cn(s.box, s.l)} />
      <Ear side="right" flick={flick === "right"} className={cn(s.box, s.r)} />
    </>
  );
}

function Ear({ side, flick, className }: { side: Side; flick: boolean; className: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion();
  const left = side === "left";

  useEffect(() => {
    if (!flick || reduce || !ref.current) return;
    const sign = left ? -1 : 1;
    const a = ref.current.animate(
      FLICK.map((deg, i) => ({ rotate: `${sign * deg}deg`, offset: FLICK_AT[i] })),
      { duration: 5500, delay: 1200, iterations: Infinity, easing: "ease-in-out" },
    );
    return () => a.cancel();
  }, [flick, reduce, left]);

  return (
    <svg
      ref={ref}
      viewBox="0 0 36 24"
      aria-hidden="true"
      className={cn(
        "absolute fill-surface-raised",
        left ? "-rotate-14 origin-bottom-right" : "rotate-14 origin-bottom-left",
        className,
      )}
    >
      {/* base côncava: a orelha "nasce" do balão em vez de ficar apoiada nele */}
      <path
        d={
          left
            ? "M0 24Q6.5 24 8.5 17.5L11.5 5Q12.8 .6 16.2 2.8L27 12.5Q31 16.5 36 24Z"
            : "M0 24Q5 16.5 9 12.5L19.8 2.8Q23.2 .6 24.5 5L27.5 17.5Q29.5 24 36 24Z"
        }
      />
    </svg>
  );
}
