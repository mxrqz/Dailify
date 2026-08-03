import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "framer-motion";
import { SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copy } from "./copy";

/**
 * Static mock of a week strip — purely decorative, not wired to a real calendar/date. One cell is
 * marked as "today" to demonstrate the crimson "hoje" highlight described in the design spec.
 */
const weekMock = [
  { label: "SEG", day: "11", isToday: false },
  { label: "TER", day: "12", isToday: false },
  { label: "QUA", day: "13", isToday: false },
  { label: "QUI", day: "14", isToday: true },
  { label: "SEX", day: "15", isToday: false },
  { label: "SÁB", day: "16", isToday: false },
  { label: "DOM", day: "17", isToday: false },
] as const;

/** Static mock task rows either side of the "agora" (now) line — decorative, not real data. */
const earlyTasks = [
  { time: "08:30", title: "Revisar PRs", duration: "30min" },
  { time: "09:15", title: "Reunião de time", duration: "45min" },
] as const;
const lateTasks = [{ time: "11:00", title: "Escrever proposta", duration: "1h30" }] as const;

/** One time-label + task-chip row of the day-view mock, sharing the row/time/chip stagger variants. */
function TaskRow({
  time,
  title,
  duration,
  rowVariants,
  timeVariants,
  chipVariants,
}: {
  time: string;
  title: string;
  duration: string;
  rowVariants: Variants;
  timeVariants: Variants;
  chipVariants: Variants;
}): JSX.Element {
  return (
    <motion.div variants={rowVariants} className="flex items-center gap-3">
      <motion.span
        variants={timeVariants}
        className="w-12 shrink-0 text-right font-mono text-2xs text-muted-foreground"
      >
        {time}
      </motion.span>
      <motion.div
        variants={chipVariants}
        className="flex flex-1 items-center justify-between gap-3 border-l-2 border-border py-2 pl-3"
      >
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
        <span className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-2xs text-muted-foreground">
          {duration}
        </span>
      </motion.div>
    </motion.div>
  );
}

/**
 * Landing hero — headline + CTAs on the left, a self-contained animated mock of the day-view
 * panel on the right. The panel is presentational only (no auth/data wiring): a header, a mini
 * week strip with "hoje" lit in crimson, and task rows around a pulsing "agora" line.
 *
 * Entrance (whileInView, once): the week strip lights up, then task rows cascade in stagger
 * (each row's time label leads its task chip), and the "agora" line draws in and pulses on a
 * loop. The panel also gets a light Y parallax on scroll. `useReducedMotion()` collapses all of
 * this to the final static state — no stagger, no pulse, no parallax.
 */
export function Hero(): JSX.Element {
  const reduce = useReducedMotion();
  const panelAnchorRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: panelAnchorRef,
    offset: ["start end", "end start"],
  });
  const parallaxY = useTransform(scrollYProgress, [0, 1], [-24, 24]);

  const panelVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduce ? 0 : 0.16, delayChildren: reduce ? 0 : 0.1 },
    },
  };
  const weekVariants = {
    hidden: { opacity: 0, y: reduce ? 0 : -6 },
    visible: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.35 } },
  };
  const rowVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.08 } },
  };
  const timeVariants = {
    hidden: { opacity: 0, x: reduce ? 0 : -8 },
    visible: { opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.3 } },
  };
  const chipVariants = {
    hidden: { opacity: 0, x: reduce ? 0 : 10 },
    visible: { opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.3 } },
  };
  const nowLineVariants = {
    hidden: { opacity: 0, scaleX: reduce ? 1 : 0 },
    visible: { opacity: 1, scaleX: 1, transition: { duration: reduce ? 0 : 0.4 } },
  };
  const dayVariants = { hidden: {}, visible: {} };
  const todayVariants = {
    hidden: { opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: reduce ? 0 : 0.35, delay: reduce ? 0 : 0.5 },
    },
  };

  return (
    <section className="grid w-full items-center gap-10 px-[clamp(1rem,5vw,24rem)] py-20 md:grid-cols-2 md:gap-16 md:py-28">
      <div className="flex flex-col gap-6 md:gap-8">
        <p className="font-mono text-xs uppercase tracking-[0.04em] text-muted-foreground">
          {copy.hero.eyebrow}
        </p>

        <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-6xl">
          {copy.hero.titleLead} <span className="text-accent-primary">{copy.hero.titleAccent}</span>{" "}
          {copy.hero.titleTail}
        </h1>

        <p className="max-w-md text-lg text-content-secondary">{copy.hero.subtitle}</p>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            size="lg"
            className="bg-accent-primary text-primary-foreground hover:bg-accent-hover"
          >
            {copy.hero.ctaPrimary}
          </Button>
          <Button
            size="lg"
            variant="ghost"
            className="border bg-transparent hover:bg-surface-hover"
          >
            {copy.hero.ctaSecondary}
          </Button>
        </div>

        <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {copy.hero.commandHint}
        </p>
      </div>

      <div ref={panelAnchorRef}>
        <motion.div style={{ y: reduce ? 0 : parallaxY }}>
          <motion.div
            variants={panelVariants}
            initial={reduce ? "visible" : "hidden"}
            whileInView="visible"
            viewport={{ once: true }}
            className="[transform:perspective(1200px)_rotateY(-6deg)] overflow-hidden rounded-panel border border-t-highlight bg-surface-panel shadow-panel"
          >
            {/* header — 3 window dots + decorative theme icon */}
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
                <span className="size-2.5 rounded-full bg-border" />
              </div>
              <SunIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>

            {/* mini week strip — "hoje" lit in crimson */}
            <motion.div
              variants={weekVariants}
              className="flex items-center justify-between gap-1 border-b px-5 py-4"
            >
              {weekMock.map((d) => (
                <div key={d.label} className="flex flex-col items-center gap-1.5">
                  <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
                    {d.label}
                  </span>
                  <motion.span
                    variants={d.isToday ? todayVariants : dayVariants}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full font-mono text-xs",
                      d.isToday
                        ? "bg-accent-primary text-primary-foreground shadow-[0_0_12px_var(--accent-glow)]"
                        : "text-foreground",
                    )}
                  >
                    {d.day}
                  </motion.span>
                </div>
              ))}
            </motion.div>

            {/* task rows around the pulsing "agora" line */}
            <div className="flex flex-col gap-3 px-5 py-5">
              {earlyTasks.map((task) => (
                <TaskRow
                  key={task.time}
                  {...task}
                  rowVariants={rowVariants}
                  timeVariants={timeVariants}
                  chipVariants={chipVariants}
                />
              ))}

              <motion.div variants={rowVariants} className="flex items-center gap-3 py-1">
                <motion.span
                  variants={timeVariants}
                  className="w-12 shrink-0 text-right font-mono text-2xs text-accent-primary"
                >
                  agora
                </motion.span>
                <motion.div
                  variants={nowLineVariants}
                  style={{ transformOrigin: "left" }}
                  className="flex-1"
                >
                  <motion.div
                    className="h-px w-full bg-accent-primary shadow-[0_0_12px_var(--accent-glow)]"
                    animate={reduce ? undefined : { opacity: [0.55, 1, 0.55] }}
                    transition={
                      reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
                    }
                  />
                </motion.div>
              </motion.div>

              {lateTasks.map((task) => (
                <TaskRow
                  key={task.time}
                  {...task}
                  rowVariants={rowVariants}
                  timeVariants={timeVariants}
                  chipVariants={chipVariants}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
