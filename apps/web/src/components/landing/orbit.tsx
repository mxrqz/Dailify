import { motion } from "framer-motion";

/**
 * Orbit — anel tracejado com um "comet" (bolinha maior à frente + rastro menor colado atrás)
 * percorrendo-o. Base visual da recorrência do hero: serve como laço grande animado (skeleton da
 * cena, Fase A) e como ícone estático pequeno (card / futuro ícone de recorrência). Decorativo
 * (`aria-hidden`). Cores só por tokens (`fill-*` / `stroke-*`) — sem hex.
 *
 * Geometria num viewBox fixo 120×120 (centro 60,60); `size` só escala o render, então todos os
 * knobs (raio, stroke, dash, bolinhas) são proporcionais e escalam juntos. A cabeça fica levemente
 * à direita do topo e o rastro cai à esquerda → com `animated` gira no horário e "aponta pra direita".
 */

const C = 60; // centro do viewBox
const HEAD_ANGLE = 9; // graus (horário, a partir do topo): cabeça um tico à direita
const TRAIL_GAP = 11; // graus entre as bolinhas do rastro

const rad = (deg: number): number => (deg * Math.PI) / 180;
/** ponto no anel a `deg` graus no sentido horário a partir do topo */
const pt = (deg: number, r: number): [number, number] => [
  +(C + r * Math.sin(rad(deg))).toFixed(2),
  +(C - r * Math.cos(rad(deg))).toFixed(2),
];

export interface OrbitProps {
  /** lado do svg renderizado, em px */
  size?: number;
  /** comet percorre o anel; false = pausado/estático */
  animated?: boolean;
  /** segundos por volta */
  speed?: number;
  /** raio do anel (unidades do viewBox) */
  radius?: number;
  /** espessura do traço do anel */
  strokeWidth?: number;
  /** [traço, vão] do tracejado */
  dash?: [number, number];
  /** token de cor do anel (stroke-*) */
  ringClassName?: string;
  /** token de cor das bolinhas (fill-*) */
  dotClassName?: string;
  /** raio da bolinha da frente (as de trás caem proporcionalmente) */
  headRadius?: number;
  /** nº de bolinhas atrás da cabeça */
  trail?: number;
  /** glow na cabeça (via --accent-glow) */
  glow?: boolean;
  /** glifo ↻ no centro */
  glyph?: boolean;
  /** vão (graus) do anel no topo, sob o comet — ignorado quando `animated` */
  gapDegrees?: number;
  className?: string;
}

export function Orbit({
  size = 48,
  animated = false,
  speed = 6,
  radius = 44,
  strokeWidth = 2,
  dash = [3, 9],
  ringClassName = "stroke-surface-line",
  dotClassName = "fill-accent-primary",
  headRadius = 7,
  trail = 2,
  glow = false,
  glyph = false,
  gapDegrees = 0,
  className,
}: OrbitProps): JSX.Element {
  // bolinhas: cabeça (i=0) grande/opaca → rastro menor e mais fraco, colado atrás à esquerda
  const dots = Array.from({ length: trail + 1 }, (_, i) => {
    const [x, y] = pt(HEAD_ANGLE - i * TRAIL_GAP, radius);
    return {
      x,
      y,
      r: +(headRadius * Math.pow(0.76, i)).toFixed(2),
      opacity: i === 0 ? 1 : +(0.5 * Math.pow(0.45, i - 1)).toFixed(3),
    };
  });

  // anel: círculo cheio ou arco com vão no topo (só quando estático)
  const gap = animated ? 0 : gapDegrees;
  const ringStroke = {
    className: ringClassName,
    strokeWidth,
    strokeDasharray: dash.join(" "),
    strokeLinecap: "round" as const,
    fill: "none",
  };
  let ring: JSX.Element;
  if (gap > 0) {
    const [sx, sy] = pt(gap / 2, radius); // ponta direita do arco
    const [ex, ey] = pt(-gap / 2, radius); // ponta esquerda
    ring = <path d={`M ${sx} ${sy} A ${radius} ${radius} 0 1 1 ${ex} ${ey}`} {...ringStroke} />;
  } else {
    ring = <circle cx={C} cy={C} r={radius} {...ringStroke} />;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      {ring}

      {glyph && (
        <g
          transform="translate(120,0) scale(-1,1)"
          className="stroke-muted-foreground"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M54 60a6 6 0 1 1 1.8 4.3" />
          <path d="M54 54v6h6" />
        </g>
      )}

      <motion.g
        style={{ transformOrigin: `${C}px ${C}px`, transformBox: "view-box" }}
        animate={animated ? { rotate: 360 } : undefined}
        transition={animated ? { duration: speed, repeat: Infinity, ease: "linear" } : undefined}
      >
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x}
            cy={d.y}
            r={d.r}
            className={dotClassName}
            opacity={d.opacity}
            style={
              i === 0 && glow ? { filter: "drop-shadow(0 0 6px var(--accent-glow))" } : undefined
            }
          />
        ))}
      </motion.g>
    </svg>
  );
}
