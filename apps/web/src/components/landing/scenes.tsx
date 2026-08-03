import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Six original "concept scenes" that visualize TIME for the landing feature bento (Task 7 cell
 * contents). Each is a pure, presentational SVG/CSS composition — crimson (`accent-primary` /
 * `--accent-glow`) + neutrals (`muted-foreground`, `border`, `surface-card`) only, no second vivid
 * color. Each accepts an optional `className`, fills its container, and gates EVERY animation
 * behind `useReducedMotion()`: when reduced, the scene renders its final static state (no sweep,
 * orbit, waveform pulse, or "agora" pulse).
 *
 * Fill/stroke use Tailwind's token-generated `fill-*` / `stroke-*` utilities; gradient stops and
 * glows reference the `--primary` / `--accent-glow` CSS vars directly (tokens, never raw hex).
 */

/**
 * Shared entrance wrapper: fades a whole scene in once on scroll. Loops (pulse/sweep/orbit) live on
 * inner elements and are gated separately. `reduce` collapses the fade to an instant final state.
 */
function Reveal({
  reduce,
  children,
}: {
  reduce: boolean | null;
  children: ReactNode;
}): JSX.Element {
  return (
    <motion.g
      initial={{ opacity: reduce ? 1 : 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: reduce ? 0 : 0.6, ease: "easeOut" }}
    >
      {children}
    </motion.g>
  );
}

function SceneFrame({
  viewBox,
  className,
  children,
}: {
  viewBox: string;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn("h-full w-full", className)} aria-hidden="true">
      <svg viewBox={viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {children}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * SceneCalendar — your month at a glance, today is now.
 * A mini month grid; task ticks fill some days; the "hoje" cell is lit crimson; a soft crimson
 * sheen sweeps across the grid and settles the eye on today.
 * ---------------------------------------------------------------------------------------------- */

const CAL_FIRST_WEEKDAY = 2; // month starts on a Tuesday (Sun = 0)
const CAL_DAYS = 31;
const CAL_TODAY = 14;
const CAL_TASK_COUNTS: Record<number, number> = {
  2: 1,
  5: 2,
  8: 1,
  11: 3,
  14: 2,
  16: 1,
  19: 2,
  22: 1,
  23: 1,
  27: 3,
  29: 1,
};
const CAL_WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
const CAL_COL_X = (col: number): number => 16 + col * 28;
const CAL_ROW_Y = (row: number): number => 34 + row * 30;

export function SceneCalendar({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();
  const cells = Array.from({ length: 35 }, (_, i) => i - CAL_FIRST_WEEKDAY + 1);

  return (
    <SceneFrame viewBox="0 0 208 192" className={className}>
      <defs>
        <linearGradient id="cal-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <Reveal reduce={reduce}>
        {CAL_WEEKDAYS.map((wd, col) => (
          <text
            key={col}
            x={CAL_COL_X(col) + 12}
            y={18}
            textAnchor="middle"
            fontSize="8"
            letterSpacing="0.6"
            className="fill-muted-foreground font-mono"
          >
            {wd}
          </text>
        ))}

        {cells.map((day, i) => {
          if (day < 1 || day > CAL_DAYS) return null;
          const x = CAL_COL_X(i % 7);
          const y = CAL_ROW_Y(Math.floor(i / 7));
          const isToday = day === CAL_TODAY;
          const count = CAL_TASK_COUNTS[day] ?? 0;

          return (
            <g key={day}>
              <rect
                x={x}
                y={y}
                width={24}
                height={22}
                rx={5}
                className={cn(
                  isToday ? "fill-accent-primary stroke-accent-primary" : "fill-none stroke-border",
                )}
                strokeWidth={1}
                style={isToday ? { filter: "drop-shadow(0 0 6px var(--accent-glow))" } : undefined}
              />
              <text
                x={x + 12}
                y={count > 0 ? y + 10 : y + 13}
                textAnchor="middle"
                fontSize="8.5"
                className={cn(
                  "font-mono",
                  isToday
                    ? "fill-primary-foreground"
                    : count > 0
                      ? "fill-foreground"
                      : "fill-muted-foreground",
                )}
              >
                {day}
              </text>
              {count > 0 &&
                Array.from({ length: count }, (_, k) => (
                  <circle
                    key={k}
                    cx={x + 12 + (k - (count - 1) / 2) * 4.5}
                    cy={y + 16}
                    r={1.3}
                    className={isToday ? "fill-primary-foreground" : "fill-muted-foreground"}
                  />
                ))}
            </g>
          );
        })}
      </Reveal>

      {!reduce && (
        <motion.rect
          x={-24}
          y={26}
          width={40}
          height={158}
          fill="url(#cal-sweep)"
          style={{ filter: "blur(1px)" }}
          animate={{ x: [-24, 192] }}
          transition={{ duration: 3.4, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
        />
      )}
    </SceneFrame>
  );
}

/* -------------------------------------------------------------------------------------------------
 * SceneHours — the day as a timed column.
 * A vertical timeline axis with hour marks; task blocks slotted at their hours; a crimson "agora"
 * line crosses the column and pulses.
 * ---------------------------------------------------------------------------------------------- */

const HOURS_MARKS = ["08", "10", "12", "14", "16", "18"] as const;
const HOURS_BLOCKS = [
  { y: 32, h: 24, w: 96, accent: false },
  { y: 60, h: 16, w: 74, accent: false },
  { y: 104, h: 30, w: 116, accent: true },
  { y: 148, h: 18, w: 88, accent: false },
] as const;
const HOURS_NOW_Y = 96;

export function SceneHours({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <SceneFrame viewBox="0 0 200 192" className={className}>
      <Reveal reduce={reduce}>
        {/* axis */}
        <line x1={44} y1={22} x2={44} y2={182} className="stroke-border" strokeWidth={1} />
        {HOURS_MARKS.map((mark, i) => {
          const y = 28 + i * 29;
          return (
            <g key={mark}>
              <line
                x1={40}
                y1={y}
                x2={44}
                y2={y}
                className="stroke-muted-foreground"
                strokeWidth={1}
              />
              <text
                x={34}
                y={y + 3}
                textAnchor="end"
                fontSize="8"
                letterSpacing="0.4"
                className="fill-muted-foreground font-mono"
              >
                {mark}
              </text>
            </g>
          );
        })}

        {/* task blocks slotted into their hours */}
        {HOURS_BLOCKS.map((b, i) => (
          <motion.g
            key={i}
            initial={{ opacity: reduce ? 1 : 0, x: reduce ? 0 : -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : 0.2 + i * 0.12 }}
          >
            <rect
              x={54}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={5}
              className={cn(
                b.accent
                  ? "fill-accent-subtle stroke-accent-primary"
                  : "fill-surface-card stroke-border",
              )}
              strokeWidth={1}
            />
            <rect
              x={54}
              y={b.y}
              width={3}
              height={b.h}
              className={b.accent ? "fill-accent-primary" : "fill-muted-foreground"}
            />
            <rect
              x={64}
              y={b.y + b.h / 2 - 2.5}
              width={b.w - 22}
              height={5}
              rx={2.5}
              className="fill-muted-foreground/50"
            />
          </motion.g>
        ))}
      </Reveal>

      {/* "agora" line crossing the column */}
      <motion.g
        initial={{ opacity: reduce ? 1 : 0, scaleX: reduce ? 1 : 0 }}
        whileInView={{ opacity: 1, scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : 0.7 }}
        style={{ transformOrigin: "44px 96px", transformBox: "view-box" }}
      >
        <motion.line
          x1={30}
          y1={HOURS_NOW_Y}
          x2={190}
          y2={HOURS_NOW_Y}
          className="stroke-accent-primary"
          strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 0 5px var(--accent-glow))" }}
          animate={reduce ? undefined : { opacity: [0.55, 1, 0.55] }}
          transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <circle cx={44} cy={HOURS_NOW_Y} r={3.5} className="fill-accent-primary" />
        <text
          x={190}
          y={HOURS_NOW_Y - 5}
          textAnchor="end"
          fontSize="8"
          letterSpacing="0.6"
          className="fill-accent-primary font-mono"
        >
          AGORA
        </text>
      </motion.g>
    </SceneFrame>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ScenePriority — what matters rises.
 * A stack of task bars, each with a weight meter; on entrance the crimson (highest-weight) bar
 * travels up from the bottom and settles on top while the rest fall into place.
 * ---------------------------------------------------------------------------------------------- */

const PRIORITY_BARS = [
  { y: 16, from: 84, delay: 0.5, weight: 4, accent: true },
  { y: 54, from: -14, delay: 0.16, weight: 3, accent: false },
  { y: 92, from: -22, delay: 0.24, weight: 2, accent: false },
  { y: 130, from: -30, delay: 0.32, weight: 1, accent: false },
] as const;

export function ScenePriority({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <SceneFrame viewBox="0 0 200 172" className={className}>
      <Reveal reduce={reduce}>
        {PRIORITY_BARS.map((bar, i) => (
          <motion.g
            key={i}
            initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : bar.from }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: reduce ? 0 : 0.6,
              delay: reduce ? 0 : bar.delay,
              ease: "easeOut",
            }}
          >
            <rect
              x={16}
              y={bar.y}
              width={168}
              height={26}
              rx={8}
              className={cn(
                bar.accent
                  ? "fill-accent-subtle stroke-accent-primary"
                  : "fill-surface-card stroke-border",
              )}
              strokeWidth={1}
              style={bar.accent ? { filter: "drop-shadow(0 0 6px var(--accent-glow))" } : undefined}
            />
            {/* drag grip */}
            {[0, 1, 2].map((r) =>
              [0, 1].map((c) => (
                <circle
                  key={`${r}-${c}`}
                  cx={26 + c * 4}
                  cy={bar.y + 9 + r * 4}
                  r={1.1}
                  className={bar.accent ? "fill-accent-primary/70" : "fill-muted-foreground/60"}
                />
              )),
            )}
            {/* title line */}
            <rect
              x={40}
              y={bar.y + 10.5}
              width={bar.accent ? 78 : 62}
              height={5}
              rx={2.5}
              className={bar.accent ? "fill-accent-primary/70" : "fill-muted-foreground/55"}
            />
            {/* weight meter */}
            {[0, 1, 2, 3].map((t) => {
              const filled = t < bar.weight;
              return (
                <rect
                  key={t}
                  x={150 + t * 7}
                  y={bar.y + 8}
                  width={3.5}
                  height={10}
                  rx={1.5}
                  className={cn(
                    !filled
                      ? "fill-border"
                      : bar.accent
                        ? "fill-accent-primary"
                        : "fill-muted-foreground",
                  )}
                />
              );
            })}
          </motion.g>
        ))}
      </Reveal>
    </SceneFrame>
  );
}

/* -------------------------------------------------------------------------------------------------
 * SceneRecurrence — it comes back on its own.
 * A dashed loop with a crimson task node orbiting; faint "ghost" repeats trail behind it; mono
 * cadence labels Diário / Semanal / Mensal below, the active one lit crimson.
 * ---------------------------------------------------------------------------------------------- */

const REC_CENTER = { x: 110, y: 84 } as const;
const REC_RADIUS = 56;
// Ghost nodes trail the head (top of ring) at widening clockwise offsets, fading out.
const REC_NODES = [
  { x: 110, y: 28, r: 6, opacityClass: "fill-accent-primary", head: true },
  { x: 96, y: 30, r: 5, opacityClass: "fill-accent-primary/50", head: false },
  { x: 83, y: 35, r: 4.5, opacityClass: "fill-accent-primary/30", head: false },
  { x: 71, y: 42, r: 4, opacityClass: "fill-accent-primary/16", head: false },
] as const;
const REC_LABELS = [
  { text: "DIÁRIO", x: 55, active: false },
  { text: "SEMANAL", x: 110, active: true },
  { text: "MENSAL", x: 165, active: false },
] as const;

export function SceneRecurrence({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <SceneFrame viewBox="0 0 220 196" className={className}>
      <Reveal reduce={reduce}>
        {/* the loop */}
        <circle
          cx={REC_CENTER.x}
          cy={REC_CENTER.y}
          r={REC_RADIUS}
          fill="none"
          className="stroke-border"
          strokeWidth={1.5}
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
        {/* recurrence glyph at the center */}
        <path
          d="M104 84a6 6 0 1 1 1.8 4.3"
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d="M104 78v6h6"
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* orbiting node + trailing ghosts */}
        <motion.g
          style={{ transformOrigin: "110px 84px", transformBox: "view-box" }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={reduce ? undefined : { duration: 14, repeat: Infinity, ease: "linear" }}
        >
          {REC_NODES.map((n, i) => (
            <circle
              key={i}
              cx={n.x}
              cy={n.y}
              r={n.r}
              className={n.opacityClass}
              style={n.head ? { filter: "drop-shadow(0 0 5px var(--accent-glow))" } : undefined}
            />
          ))}
        </motion.g>

        {/* cadence labels */}
        {REC_LABELS.map((l) => (
          <g key={l.text}>
            <text
              x={l.x}
              y={180}
              textAnchor="middle"
              fontSize="8.5"
              letterSpacing="0.6"
              className={
                l.active ? "fill-accent-primary font-mono" : "fill-muted-foreground font-mono"
              }
            >
              {l.text}
            </text>
            {l.active && (
              <rect
                x={l.x - 12}
                y={185}
                width={24}
                height={2}
                rx={1}
                className="fill-accent-primary"
              />
            )}
          </g>
        ))}
      </Reveal>
    </SceneFrame>
  );
}

/* -------------------------------------------------------------------------------------------------
 * SceneVoice — you speak, it becomes tasks. (HERO scene, gets the 2× cell.)
 * A crimson waveform on the left resolves, left→right, into two structured task rows: the row
 * "title" lines transcribe in (grow width from the left), chevrons flow toward them.
 * ---------------------------------------------------------------------------------------------- */

const VOICE_BARS = [
  6, 11, 16, 23, 14, 29, 20, 35, 24, 41, 30, 45, 34, 41, 26, 37, 22, 31, 16, 23, 11, 15,
] as const;
const VOICE_ROWS = [
  { y: 40, title: 66, sub: 40, tag: "09:00" },
  { y: 96, title: 52, sub: 32, tag: "AMANHÃ" },
] as const;

export function SceneVoice({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <SceneFrame viewBox="0 0 340 170" className={className}>
      {/* waveform — pulses in a listening pattern */}
      <Reveal reduce={reduce}>
        <g style={{ filter: "drop-shadow(0 0 5px var(--accent-glow))" }}>
          {VOICE_BARS.map((h, i) => (
            <motion.rect
              key={i}
              x={18 + i * 6}
              y={85 - h / 2}
              width={3.4}
              height={h}
              rx={1.7}
              className="fill-accent-primary"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
              animate={reduce ? undefined : { scaleY: [0.45, 1.1, 0.45] }}
              transition={
                reduce
                  ? undefined
                  : {
                      duration: 1.5,
                      repeat: Infinity,
                      repeatType: "mirror",
                      ease: "easeInOut",
                      delay: i * 0.05,
                    }
              }
            />
          ))}
        </g>

        {/* flow chevrons: waveform → tasks */}
        {[0, 1, 2].map((i) => (
          <motion.path
            key={i}
            d={`M${160 + i * 9} 79l6 6-6 6`}
            fill="none"
            className="stroke-muted-foreground"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={reduce ? undefined : { opacity: [0.25, 1, 0.25] }}
            transition={
              reduce
                ? undefined
                : { duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }
            }
          />
        ))}

        {/* structured task rows */}
        {VOICE_ROWS.map((row, i) => (
          <motion.g
            key={i}
            initial={{ opacity: reduce ? 1 : 0, x: reduce ? 0 : 10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : 0.2 + i * 0.18 }}
          >
            <rect
              x={196}
              y={row.y}
              width={130}
              height={46}
              rx={10}
              className="fill-surface-card stroke-border"
              strokeWidth={1}
            />
            <circle
              cx={214}
              cy={row.y + 23}
              r={5}
              className="fill-accent-primary"
              style={{ filter: "drop-shadow(0 0 4px var(--accent-glow))" }}
            />
            <motion.rect
              x={228}
              y={row.y + 13}
              width={row.title}
              height={6}
              rx={3}
              className="fill-muted-foreground/70"
              style={{ transformBox: "fill-box", transformOrigin: "left" }}
              initial={{ scaleX: reduce ? 1 : 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.4 + i * 0.18 }}
            />
            <motion.rect
              x={228}
              y={row.y + 25}
              width={row.sub}
              height={5}
              rx={2.5}
              className="fill-muted-foreground/40"
              style={{ transformBox: "fill-box", transformOrigin: "left" }}
              initial={{ scaleX: reduce ? 1 : 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.55 + i * 0.18 }}
            />
            <text
              x={316}
              y={row.y + 15}
              textAnchor="end"
              fontSize="7.5"
              letterSpacing="0.5"
              className="fill-accent-primary font-mono"
            >
              {row.tag}
            </text>
          </motion.g>
        ))}
      </Reveal>
    </SceneFrame>
  );
}

/* -------------------------------------------------------------------------------------------------
 * SceneReminders — it taps you at the right moment.
 * A bell that wobbles above a mini-timeline; a crimson marker sits at the alert offset and pulses
 * a sonar ring; a dotted line drops from the bell to that moment.
 * ---------------------------------------------------------------------------------------------- */

const REM_ALERT_X = 138;
const REM_TIMELINE_Y = 150;
const REM_TICKS = [24, 62, 100, REM_ALERT_X, 176] as const;

export function SceneReminders({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <SceneFrame viewBox="0 0 200 180" className={className}>
      <Reveal reduce={reduce}>
        {/* bell — wobbles around its top pivot */}
        <motion.g
          style={{ transformOrigin: "100px 34px", transformBox: "view-box" }}
          animate={reduce ? undefined : { rotate: [-9, 9, -9] }}
          transition={reduce ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <circle cx={100} cy={34} r={3} className="fill-muted-foreground" />
          <path
            d="M100 37c9 0 15 6 15 16 0 9 3 13 6 18H79c3-5 6-9 6-18 0-10 6-16 15-16Z"
            fill="none"
            className="stroke-muted-foreground"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path
            d="M94 71a6 6 0 0 0 12 0"
            fill="none"
            className="stroke-muted-foreground"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </motion.g>

        {/* dotted drop from bell to the alert moment */}
        <line
          x1={REM_ALERT_X}
          y1={84}
          x2={REM_ALERT_X}
          y2={REM_TIMELINE_Y - 8}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="2 4"
        />

        {/* mini-timeline */}
        <line
          x1={24}
          y1={REM_TIMELINE_Y}
          x2={176}
          y2={REM_TIMELINE_Y}
          className="stroke-border"
          strokeWidth={1}
        />
        {REM_TICKS.map((tx) => (
          <line
            key={tx}
            x1={tx}
            y1={REM_TIMELINE_Y - 3}
            x2={tx}
            y2={REM_TIMELINE_Y + 3}
            className="stroke-muted-foreground"
            strokeWidth={1}
          />
        ))}

        {/* alert marker + pulsing sonar ring */}
        {!reduce &&
          [0, 1].map((i) => (
            <motion.circle
              key={i}
              cx={REM_ALERT_X}
              cy={REM_TIMELINE_Y}
              className="fill-accent-primary"
              initial={{ r: 4, opacity: 0.55 }}
              animate={{ r: [4, 17], opacity: [0.55, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: i * 1 }}
            />
          ))}
        <circle
          cx={REM_ALERT_X}
          cy={REM_TIMELINE_Y}
          r={4}
          className="fill-accent-primary"
          style={{ filter: "drop-shadow(0 0 5px var(--accent-glow))" }}
        />
        <text
          x={REM_ALERT_X}
          y={REM_TIMELINE_Y + 17}
          textAnchor="middle"
          fontSize="8"
          letterSpacing="0.6"
          className="fill-accent-primary font-mono"
        >
          LEMBRETE
        </text>
      </Reveal>
    </SceneFrame>
  );
}
