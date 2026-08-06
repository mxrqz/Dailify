import { motion } from "framer-motion";

/**
 * Checklist — ícone animado da família do <Orbit> (tarefas). Três itens de lista onde os checks
 * accent aparecem de cima pra baixo, em loop (preenchendo). Decorativo (`aria-hidden`), cores por
 * token. `animated=false` mostra o estado final (todos marcados). viewBox fixo 48×48; `size` escala.
 */

const ROWS = [10, 22, 34] as const; // y de cada linha
const EASE = [0.16, 1, 0.3, 1] as const;

export interface ChecklistProps {
  /** lado do svg em px */
  size?: number;
  /** checks preenchem em loop; false = estático (todos marcados) */
  animated?: boolean;
  /** segundos por ciclo */
  speed?: number;
  className?: string;
}

export function Checklist({
  size = 48,
  animated = false,
  speed = 3.2,
  className,
}: ChecklistProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      {ROWS.map((y, i) => (
        <g key={y}>
          <rect
            x={8}
            y={y}
            width={8}
            height={8}
            rx={2}
            fill="none"
            className="stroke-surface-line"
            strokeWidth={1.6}
          />
          <rect x={20} y={y + 2.5} width={20} height={3} rx={1.5} className="fill-surface-line" />
          <motion.path
            d={`M9.5 ${y + 4}l1.8 1.8 3.2-3.6`}
            fill="none"
            className="stroke-accent-primary"
            strokeWidth={1.8}
            strokeLinejoin="round"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={animated ? { opacity: 0, scale: 0.4 } : { opacity: 1, scale: 1 }}
            animate={animated ? { opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.4] } : undefined}
            transition={
              animated
                ? {
                    duration: speed,
                    times: [0, 0.14, 0.88, 1],
                    repeat: Infinity,
                    delay: i * (speed * 0.14),
                    ease: EASE,
                  }
                : undefined
            }
          />
        </g>
      ))}
    </svg>
  );
}
