import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * Efeitos decorativos do painel (glow + ruído), separados e parametrizados — dá pra ajustar sem
 * abrir este arquivo, tudo por prop/className no ponto de uso.
 */

/**
 * Glow radial do painel. Usa o `bg-radial` nativo do Tailwind (não é círculo + blur) — um
 * radial-gradient de verdade, do canto pra transparente. Default: elipse no top-left, de
 * `surface-hover` até transparente em 70%. Ajuste posição/cor/spread pelo `className` com classes
 * literais (o JIT precisa vê-las): ex. `bg-radial-[at_20%_10%] from-surface-panel to-80%`.
 */
export function RadialGlow({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "pointer-events-none absolute inset-0 bg-radial-[at_top_left] from-surface-panel from-0% to-surface-page to-70%",
        className,
      )}
    />
  );
}

/**
 * Ruído (feTurbulence) parametrizável — dobra como textura e como dither pro banding do gradiente.
 * Todos os knobs por prop; a máscara/posicionamento extra (ex. seguir o glow) entra pelo `className`.
 * `id` precisa ser único se houver mais de um `<Noise>` na página (filtros SVG têm id global).
 */
export function Noise({
  opacity = 0.1,
  baseFrequency = 0.9,
  numOctaves = 2,
  blend = "overlay",
  id = "noise",
  className,
}: {
  opacity?: number;
  baseFrequency?: number;
  numOctaves?: number;
  blend?: CSSProperties["mixBlendMode"];
  id?: string;
  className?: string;
}): JSX.Element {
  return (
    <div
      aria-hidden="true"
      style={{ opacity, mixBlendMode: blend }}
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <svg className="h-full w-full" preserveAspectRatio="none">
        <filter id={id}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency={baseFrequency}
            numOctaves={numOctaves}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
    </div>
  );
}

/**
 * Blur por cima (backdrop-filter) — borra tudo que está ATRÁS dele. Colocado por último com z alto,
 * borra glow + noise + cards; pra borrar só uma região, passe uma máscara pelo `className`
 * (ex. `mask-r-from-70%` borra só a borda direita). `strength` em px é o knob principal.
 */
export function Blur({
  strength = 4,
  className,
  style,
}: {
  strength?: number;
  className?: string;
  style?: CSSProperties;
}): JSX.Element {
  const filter = `blur(${strength}px)`;
  return (
    <div
      aria-hidden="true"
      style={{ backdropFilter: filter, WebkitBackdropFilter: filter, ...style }}
      className={cn("pointer-events-none absolute inset-0", className)}
    />
  );
}
