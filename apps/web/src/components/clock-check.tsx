import { motion, useReducedMotion } from "motion/react";
import { duration, ease } from "@/consts/motion";
import { cn } from "@/lib/utils";

// Posição do ponteiro das horas: 0° = 12h, sentido horário, com a fração dos minutos.
export const hourAngle = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return ((h % 12) + m / 60) * 30;
};

const CENTER = 10;
const DOT_RADIUS = 4.5;
const polar = (deg: number) => ({
  cx: CENTER + DOT_RADIUS * Math.sin((deg * Math.PI) / 180),
  cy: CENTER - DOT_RADIUS * Math.cos((deg * Math.PI) / 180),
});

type Props = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  time?: string;
  label: string;
};

export function ClockCheck({ checked, onCheckedChange, time, label }: Props) {
  const reduce = useReducedMotion();
  const dot = time ? polar(hourAngle(time)) : { cx: CENTER, cy: CENTER };

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      whileTap={{ scale: 0.9 }}
      className="relative grid size-5 shrink-0 place-items-center rounded-full focus-ring hit-target"
    >
      <svg viewBox="0 0 20 20" className="size-full" aria-hidden>
        <circle
          cx={CENTER}
          cy={CENTER}
          r="9"
          strokeWidth="1.5"
          className={cn(
            "transition-colors duration-base ease-out",
            checked ? "fill-brand stroke-brand" : "fill-transparent stroke-control-mark",
          )}
        />
        <motion.circle
          data-dot
          {...dot}
          r={1.6}
          className="fill-ink-secondary"
          animate={{ opacity: checked ? 0 : 1 }}
          transition={{ duration: reduce ? 0 : duration.fast, ease: ease.out }}
        />
        <motion.path
          d="M6 10.4l2.8 2.8L14 7.4"
          pathLength={1}
          strokeDasharray={1}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="fill-none stroke-on-brand"
          initial={false}
          animate={{ strokeDashoffset: checked ? 0 : 1 }}
          transition={{ duration: reduce ? 0 : duration.base, ease: ease.out }}
        />
      </svg>
    </motion.button>
  );
}
