import { motion } from "motion/react";
import { duration, ease } from "@/consts/motion";

// 0° = 12h, sentido horário; a hora usa o relógio de 12h com a fração dos minutos.
export const clockAngles = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return { hour: ((h % 12) + m / 60) * 30, minute: m * 6 };
};

const CENTER = 10;
const DOT_RADIUS = 6;
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
  const dots = time
    ? [
        { ...polar(clockAngles(time).hour), r: 1.6 },
        { ...polar(clockAngles(time).minute), r: 1.1 },
      ]
    : [{ cx: CENTER, cy: CENTER, r: 1.1 }];

  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      whileTap={{ scale: 0.9 }}
      className="grid size-5 shrink-0 place-items-center rounded-full"
    >
      <svg viewBox="0 0 20 20" className="size-full" aria-hidden>
        <circle
          cx={CENTER}
          cy={CENTER}
          r="9"
          strokeWidth="1.5"
          className={`transition-colors duration-base ease-out ${checked ? "fill-primary stroke-primary" : "fill-transparent stroke-pager-mark"}`}
        />
        {dots.map((d) => (
          <motion.circle
            key={`${d.cx}-${d.cy}-${d.r}`}
            data-dot
            {...d}
            className="fill-content-secondary"
            animate={{ opacity: checked ? 0 : 1 }}
            transition={{ duration: duration.fast, ease: ease.out }}
          />
        ))}
        <motion.path
          d="M6 10.4l2.8 2.8L14 7.4"
          pathLength={1}
          strokeDasharray={1}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="fill-none stroke-primary-foreground"
          initial={false}
          animate={{ strokeDashoffset: checked ? 0 : 1 }}
          transition={{ duration: duration.base, ease: ease.out }}
        />
      </svg>
    </motion.button>
  );
}
