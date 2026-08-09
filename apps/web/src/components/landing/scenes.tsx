import { useRef, type ReactNode, type RefObject } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Six "concept scenes" for the landing feature bento (Task 7 cell contents) — the DETAILS that make
 * daily execution good, deliberately distinct from the hero/tabs which own the core views (day,
 * calendar, recurrence, voice). Each is a pure, presentational SVG/CSS composition — crimson
 * (`accent-primary` / `--accent-glow`) + neutrals (`muted-foreground`, `border`, `surface-card`)
 * only, no second vivid color. Each accepts an optional `className`, fills its container, and gates
 * EVERY animation behind `useReducedMotion()`: when reduced, the scene renders its final static
 * state (no draw-in, pulse, or sonar).
 *
 * The three WIDE cells (duration / complete / browser) use a ~5:1 viewBox so their content fills the
 * ribbon's wide, short boxes; the narrow cells (free / priority / reminders) stay square-ish.
 * Scenes with `repeat: Infinity` loops (reminders bell/sonar) additionally gate those on `useInView`
 * so they idle while scrolled off-screen. Entrance reveals (`whileInView`) fire once regardless.
 *
 * Fill/stroke use Tailwind's token-generated `fill-*` / `stroke-*` utilities; glows reference the
 * `--accent-glow` CSS var directly (tokens, never raw hex).
 */

/**
 * Shared entrance wrapper: fades a whole scene in once on scroll. Loops (pulse/sonar) live on inner
 * elements and are gated separately. `reduce` collapses the fade to an instant final state.
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
  containerRef,
}: {
  viewBox: string;
  className?: string;
  children: ReactNode;
  containerRef?: RefObject<HTMLDivElement>;
}): JSX.Element {
  return (
    <div ref={containerRef} className={cn("h-full w-full", className)} aria-hidden="true">
      <svg viewBox={viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {children}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------------------------------
 * SceneDuration — every task takes real time. (WIDE cell.)
 * A horizontal hour ruler with task blocks on it; each block's WIDTH is its duration and the gaps
 * between them are the free time left in the day. Blocks grow in from the left on entrance.
 * ---------------------------------------------------------------------------------------------- */

const DURATION_HOURS = ["09", "10", "11", "12", "13", "14", "15"] as const;
const durTickX = (i: number): number => 30 + i * 72;
const DURATION_BLOCKS = [
  { x: 30, w: 108, label: 68, accent: true, delay: 0.2 },
  { x: 174, w: 108, label: 60, accent: false, delay: 0.34 },
  { x: 318, w: 144, label: 96, accent: false, delay: 0.48 },
] as const;

export function SceneDuration({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <SceneFrame viewBox="0 0 490 100" className={className}>
      <Reveal reduce={reduce}>
        {/* hour ruler */}
        <line x1={30} y1={74} x2={462} y2={74} className="stroke-border" strokeWidth={1} />
        {DURATION_HOURS.map((h, i) => (
          <g key={h + i}>
            <line
              x1={durTickX(i)}
              y1={70}
              x2={durTickX(i)}
              y2={78}
              className="stroke-muted-foreground"
              strokeWidth={1}
            />
            <text
              x={durTickX(i)}
              y={92}
              textAnchor="middle"
              fontSize="8"
              letterSpacing="0.5"
              className="fill-muted-foreground font-mono"
            >
              {h}
            </text>
          </g>
        ))}

        {/* task blocks — width = duration */}
        {DURATION_BLOCKS.map((b, i) => (
          <motion.g
            key={i}
            initial={{ opacity: reduce ? 1 : 0, scaleX: reduce ? 1 : 0 }}
            whileInView={{ opacity: 1, scaleX: 1 }}
            viewport={{ once: true }}
            transition={{
              duration: reduce ? 0 : 0.5,
              delay: reduce ? 0 : b.delay,
              ease: "easeOut",
            }}
            style={{ transformOrigin: `${b.x}px 45px`, transformBox: "view-box" }}
          >
            <rect
              x={b.x}
              y={32}
              width={b.w}
              height={26}
              rx={8}
              className={
                b.accent
                  ? "fill-accent-subtle stroke-accent-primary"
                  : "fill-surface-card stroke-border"
              }
              strokeWidth={1}
              style={b.accent ? { filter: "drop-shadow(0 0 6px var(--accent-glow))" } : undefined}
            />
            <rect
              x={b.x + 12}
              y={41}
              width={b.label}
              height={5}
              rx={2.5}
              className={b.accent ? "fill-accent-primary/70" : "fill-muted-foreground/55"}
            />
          </motion.g>
        ))}
      </Reveal>
    </SceneFrame>
  );
}

/* -------------------------------------------------------------------------------------------------
 * SceneFree — start for free. (narrow cell.)
 * A bold GRÁTIS wordmark over a short checklist whose crimson checks draw themselves in.
 * ---------------------------------------------------------------------------------------------- */

const FREE_ITEMS = [
  { y: 92, text: "sem cartão", delay: 0.3 },
  { y: 120, text: "grátis pra sempre", delay: 0.45 },
] as const;

export function SceneFree({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <SceneFrame viewBox="0 0 200 150" className={className}>
      <Reveal reduce={reduce}>
        <text
          x={100}
          y={52}
          textAnchor="middle"
          fontSize="30"
          fontWeight={600}
          letterSpacing="1"
          className="fill-accent-primary font-mono"
          style={{ filter: "drop-shadow(0 0 8px var(--accent-glow))" }}
        >
          GRÁTIS
        </text>
        {FREE_ITEMS.map((it, i) => (
          <g key={i}>
            <motion.path
              d={`M34 ${it.y}l3.4 3.6 6.6-8`}
              fill="none"
              className="stroke-accent-primary"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduce ? 1 : 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{
                duration: reduce ? 0 : 0.4,
                delay: reduce ? 0 : it.delay,
                ease: "easeOut",
              }}
            />
            <text x={54} y={it.y + 4} fontSize="12" className="fill-muted-foreground">
              {it.text}
            </text>
          </g>
        ))}
      </Reveal>
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
 * SceneComplete — one tap and the day moves forward. (WIDE cell.)
 * A short checklist: the done rows get a crimson check that draws itself in plus a struck-through
 * title; the last row is still open. Progress you can see.
 * ---------------------------------------------------------------------------------------------- */

const COMPLETE_ROWS = [
  { y: 12, done: true, w: 300, delay: 0.2 },
  { y: 44, done: true, w: 360, delay: 0.38 },
  { y: 76, done: false, w: 250, delay: 0.56 },
] as const;

export function SceneComplete({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <SceneFrame viewBox="0 0 490 100" className={className}>
      <Reveal reduce={reduce}>
        {COMPLETE_ROWS.map((r, i) => (
          <g key={i}>
            {/* checkbox */}
            <rect
              x={24}
              y={r.y}
              width={18}
              height={18}
              rx={5}
              className={r.done ? "fill-accent-primary" : "fill-surface-card stroke-border"}
              strokeWidth={1}
              style={r.done ? { filter: "drop-shadow(0 0 5px var(--accent-glow))" } : undefined}
            />
            {r.done && (
              <motion.path
                d={`M28.5 ${r.y + 9.5}l3.4 3.6 6.6-7.8`}
                fill="none"
                className="stroke-primary-foreground"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: reduce ? 1 : 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: reduce ? 0 : 0.4,
                  delay: reduce ? 0 : r.delay,
                  ease: "easeOut",
                }}
              />
            )}
            {/* title line */}
            <rect
              x={54}
              y={r.y + 6}
              width={r.w}
              height={6}
              rx={3}
              className={r.done ? "fill-muted-foreground/35" : "fill-muted-foreground/70"}
            />
            {/* strike-through on done rows */}
            {r.done && (
              <motion.rect
                x={54}
                y={r.y + 8.5}
                width={r.w}
                height={1.5}
                rx={0.75}
                className="fill-accent-primary/60"
                style={{ transformBox: "fill-box", transformOrigin: "left" }}
                initial={{ scaleX: reduce ? 1 : 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{
                  duration: reduce ? 0 : 0.4,
                  delay: reduce ? 0 : r.delay + 0.15,
                  ease: "easeOut",
                }}
              />
            )}
          </g>
        ))}
      </Reveal>
    </SceneFrame>
  );
}

/* -------------------------------------------------------------------------------------------------
 * SceneBrowser — runs in the browser, on any device. (WIDE cell.)
 * A wide browser window (traffic-light dots + a dailify.app address bar) with a mini task list
 * inside, and a phone peeking past its right edge — same app, nothing to install.
 * ---------------------------------------------------------------------------------------------- */

const BROWSER_LINES = [
  { y: 52, w: 150, accent: true },
  { y: 68, w: 120, accent: false },
  { y: 84, w: 134, accent: false },
] as const;

export function SceneBrowser({ className }: { className?: string }): JSX.Element {
  const reduce = useReducedMotion();

  return (
    <SceneFrame viewBox="0 0 490 100" className={className}>
      <Reveal reduce={reduce}>
        {/* browser window */}
        <rect
          x={22}
          y={8}
          width={396}
          height={84}
          rx={10}
          className="fill-surface-card stroke-border"
          strokeWidth={1}
        />
        {/* chrome: traffic lights */}
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={40 + i * 12}
            cy={22}
            r={3.5}
            className={i === 0 ? "fill-accent-primary" : "fill-muted-foreground/45"}
          />
        ))}
        {/* address bar */}
        <rect
          x={92}
          y={15}
          width={200}
          height={14}
          rx={7}
          className="fill-background stroke-border"
          strokeWidth={1}
        />
        <text
          x={104}
          y={25}
          fontSize="8.5"
          letterSpacing="0.4"
          className="fill-muted-foreground font-mono"
        >
          dailify.app
        </text>
        {/* chrome divider */}
        <line x1={22} y1={36} x2={418} y2={36} className="stroke-border" strokeWidth={1} />
        {/* mini task list inside */}
        {BROWSER_LINES.map((l, i) => (
          <g key={i}>
            <circle
              cx={44}
              cy={l.y}
              r={3.5}
              className={l.accent ? "fill-accent-primary" : "fill-muted-foreground/50"}
            />
            <rect
              x={56}
              y={l.y - 3}
              width={l.w}
              height={6}
              rx={3}
              className={l.accent ? "fill-muted-foreground/70" : "fill-muted-foreground/40"}
            />
          </g>
        ))}

        {/* phone peeking past the right edge — same app, on mobile */}
        <motion.g
          initial={{ opacity: reduce ? 1 : 0, x: reduce ? 0 : 14 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : 0.3, ease: "easeOut" }}
        >
          <rect
            x={398}
            y={30}
            width={46}
            height={62}
            rx={9}
            className="fill-surface-card stroke-accent-primary"
            strokeWidth={1.5}
            style={{ filter: "drop-shadow(0 0 6px var(--accent-glow))" }}
          />
          <rect
            x={412}
            y={36}
            width={18}
            height={2.5}
            rx={1.25}
            className="fill-muted-foreground/50"
          />
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={406}
              y={48 + i * 12}
              width={i === 0 ? 30 : 22}
              height={5}
              rx={2.5}
              className={i === 0 ? "fill-accent-primary/70" : "fill-muted-foreground/40"}
            />
          ))}
        </motion.g>
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
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2, once: false });
  const idle = reduce || !inView;

  return (
    <SceneFrame viewBox="0 0 200 180" className={className} containerRef={ref}>
      <Reveal reduce={reduce}>
        {/* bell — wobbles around its top pivot */}
        <motion.g
          style={{ transformOrigin: "100px 34px", transformBox: "view-box" }}
          animate={idle ? undefined : { rotate: [-9, 9, -9] }}
          transition={idle ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
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
        {!idle &&
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
