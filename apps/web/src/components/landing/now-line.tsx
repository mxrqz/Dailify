import { motion } from "framer-motion";

/**
 * NowLine — ícone animado da família do <Orbit> (horários). Um mini-eixo vertical com marcas de
 * hora e a "linha do agora" (dot + traço accent) descendo em loop. Decorativo (`aria-hidden`),
 * cores por token. `animated=false` mostra a linha parada no meio. viewBox fixo 48×48; `size` escala.
 */

const TICKS = [13, 24, 35] as const; // y das marcas de hora
const AXIS_X = 17;
const EASE = [0.16, 1, 0.3, 1] as const;

export interface NowLineProps {
  /** lado do svg em px */
  size?: number;
  /** a linha do agora desce em loop; false = estático (parada no meio) */
  animated?: boolean;
  /** segundos por ciclo */
  speed?: number;
  className?: string;
}

export function NowLine({
  size = 48,
  animated = false,
  speed = 3,
  className,
}: NowLineProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <line
        x1={AXIS_X}
        y1={8}
        x2={AXIS_X}
        y2={40}
        className="stroke-surface-line"
        strokeWidth={1.6}
      />
      {TICKS.map((y) => (
        <line
          key={y}
          x1={14}
          y1={y}
          x2={AXIS_X}
          y2={y}
          className="stroke-muted-foreground"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ))}
      <motion.g
        style={{ transformBox: "view-box" }}
        initial={animated ? { y: 9, opacity: 0 } : { y: 24, opacity: 1 }}
        animate={animated ? { y: [9, 37], opacity: [0, 1, 1, 0] } : undefined}
        transition={
          animated
            ? { duration: speed, times: [0, 0.14, 0.84, 1], repeat: Infinity, ease: EASE }
            : undefined
        }
      >
        <line
          x1={AXIS_X}
          y1={0}
          x2={38}
          y2={0}
          className="stroke-accent-primary"
          strokeWidth={1.6}
        />
        <circle cx={AXIS_X} cy={0} r={2.6} className="fill-accent-primary" />
      </motion.g>
    </svg>
  );
}
