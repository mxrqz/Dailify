import { motion } from "framer-motion";

import { copy } from "../copy";

/** Decorative loop mock — a node orbits the ring, ghost dots mark past occurrences. */
const GHOST_ANGLES = [-110, -20, 130] as const;
const LABELS = ["Diário", "Semanal", "Mensal"] as const;

function RecurrenceMock({ reduce }: { reduce: boolean }): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <div className="relative size-36">
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            r="40"
            className="fill-none stroke-border"
            strokeWidth="1.5"
            strokeDasharray="3 6"
          />
        </svg>

        {GHOST_ANGLES.map((deg) => (
          <span
            key={deg}
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -ml-0.75 -mt-0.75 size-1.5 rounded-full bg-muted-foreground/40"
            style={{ transform: `rotate(${deg}deg) translateY(-58px)` }}
          />
        ))}

        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "linear" }}
        >
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-2 size-3 -translate-x-1/2 rounded-full bg-accent-primary shadow-[0_0_10px_var(--accent-glow)]"
          />
        </motion.div>
      </div>

      <div className="flex gap-4 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
        {LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

/** RECURRENCE tab — top copy + the orbit loop visual. (Legacy layout, pending scene migration.) */
export function RecurrenceTab({ reduce }: { reduce: boolean }): JSX.Element {
  const tabCopy = copy.features.tabs.recurrence;
  return (
    <>
      <div className="mb-6 flex flex-col gap-1.5">
        <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
          {tabCopy.title}
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">{tabCopy.blurb}</p>
      </div>

      <RecurrenceMock reduce={reduce} />
    </>
  );
}
