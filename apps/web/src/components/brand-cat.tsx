import { HEAD_D } from "@/components/mew/head-path";
import { cn } from "@/lib/utils";

// cx, cy, rx, ry no viewBox, medidos no PNG original (1280²)
export const EYES = [
  [463, 803, 152, 139],
  [1004, 752, 128, 138],
] as const;
export const PUPILS = [
  [463, 806, 42, 92],
  [1004, 752, 43, 92],
] as const;
const EYE = "fill-ink dark:fill-canvas";
const HEAD = "fill-surface dark:fill-ink";

/** O gato da marca, parado. No claro fica branco com contorno: nunca vira gato preto. */
export function BrandCat({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="-160 -120 1600 1460"
      aria-hidden="true"
      className={cn("overflow-visible", className)}
    >
      <path
        transform="translate(0 1280) scale(.1 -.1)"
        d={HEAD_D}
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className={cn(HEAD, "stroke-ink-secondary dark:stroke-none")}
      />
      {EYES.map(([cx, cy, rx, ry]) => (
        <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} className={EYE} />
      ))}
      {PUPILS.map(([cx, cy, rx, ry]) => (
        <ellipse key={cx} cx={cx} cy={cy} rx={rx} ry={ry} className={HEAD} />
      ))}
      <ellipse cx={805} cy={951} rx={50} ry={30} className={EYE} />
    </svg>
  );
}
