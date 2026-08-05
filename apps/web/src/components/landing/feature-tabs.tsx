import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion, usePresence } from "framer-motion";
import { CalendarDays, Columns3, Mic, RotateCw, type LucideIcon } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { copy } from "./copy";

type TabKey = keyof typeof copy.features.tabs;

const TABS: ReadonlyArray<{ key: TabKey; icon: LucideIcon }> = [
  { key: "day", icon: Columns3 },
  { key: "calendar", icon: CalendarDays },
  { key: "recurrence", icon: RotateCw },
  { key: "voice", icon: Mic },
];

function isTabKey(value: string): value is TabKey {
  return value === "day" || value === "calendar" || value === "recurrence" || value === "voice";
}

/** Decorative day-column mock — fake times/tasks, not wired to real data. */
const dayMockEarly = [{ time: "08:30", title: "Revisar PRs" }] as const;
const dayMockLate = [
  { time: "11:00", title: "Escrever proposta" },
  { time: "13:30", title: "Almoço com o time" },
] as const;

function DayMock(): JSX.Element {
  return (
    <div className="flex flex-col gap-2.5">
      {dayMockEarly.map((task) => (
        <div key={task.time} className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-right font-mono text-2xs text-muted-foreground">
            {task.time}
          </span>
          <span className="flex-1 truncate border-l-2 border-border py-1.5 pl-3 text-sm text-foreground">
            {task.title}
          </span>
        </div>
      ))}

      <div className="flex items-center gap-3 py-0.5">
        <span className="w-12 shrink-0 text-right font-mono text-2xs text-accent-primary">
          agora
        </span>
        <span className="h-px flex-1 bg-accent-primary shadow-[0_0_10px_var(--accent-glow)]" />
      </div>

      {dayMockLate.map((task) => (
        <div key={task.time} className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-right font-mono text-2xs text-muted-foreground">
            {task.time}
          </span>
          <span className="flex-1 truncate border-l-2 border-border py-1.5 pl-3 text-sm text-foreground">
            {task.title}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Decorative month grid — fake dates, not a real calendar. Monday-start week, matching the app. */
const WEEKDAY_LABELS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"] as const;
const MONTH_DAYS: ReadonlyArray<number | null> = [
  null,
  null,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
  30,
  null,
  null,
  null,
];
const TODAY_MOCK = 14;
const TASK_DAYS_MOCK: ReadonlySet<number> = new Set([3, 7, 8, 12, 17, 22, 27]);

function CalendarMock(): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="text-center font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {MONTH_DAYS.map((day, index) => (
          <div key={index} className="flex flex-col items-center gap-0.5 py-0.5">
            {day !== null && (
              <>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-mono text-xs",
                    day === TODAY_MOCK
                      ? "bg-accent-primary text-primary-foreground"
                      : "text-foreground",
                  )}
                >
                  {day}
                </span>
                <span
                  className={cn(
                    "size-1 rounded-full",
                    TASK_DAYS_MOCK.has(day) ? "bg-accent-primary" : "bg-transparent",
                  )}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Decorative loop mock — a node orbits the ring, ghost dots mark past occurrences. */
const RECURRENCE_GHOST_ANGLES = [-110, -20, 130] as const;
const RECURRENCE_LABELS = ["Diário", "Semanal", "Mensal"] as const;

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

        {RECURRENCE_GHOST_ANGLES.map((deg) => (
          <span
            key={deg}
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] size-1.5 rounded-full bg-muted-foreground/40"
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
        {RECURRENCE_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

/** Decorative waveform → structured-task mock. Fake transcript, not wired to the real voice flow. */
const WAVE_HEIGHTS = [8, 14, 22, 30, 20, 26, 14, 10, 18, 12] as const;
const VOICE_TASK_MOCK = [
  { title: "Ligar pro dentista", time: "14:00" },
  { title: "Comprar leite", time: "18:30" },
] as const;

function VoiceMock({ reduce }: { reduce: boolean }): JSX.Element {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="flex h-16 shrink-0 items-end gap-1" aria-hidden="true">
        {WAVE_HEIGHTS.map((height, index) => (
          <motion.span
            key={index}
            className="w-1.5 rounded-full bg-accent-primary"
            style={{ height, transformOrigin: "bottom" }}
            animate={reduce ? undefined : { scaleY: [1, 1.6, 1] }}
            transition={
              reduce
                ? undefined
                : { duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: index * 0.06 }
            }
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        {VOICE_TASK_MOCK.map((task) => (
          <div
            key={task.title}
            className="flex items-center justify-between gap-3 rounded-xl border bg-surface-card px-3 py-2"
          >
            <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
            <span className="shrink-0 font-mono text-2xs text-muted-foreground">{task.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabMock({ tabKey, reduce }: { tabKey: TabKey; reduce: boolean }): JSX.Element {
  switch (tabKey) {
    case "day":
      return <DayMock />;
    case "calendar":
      return <CalendarMock />;
    case "recurrence":
      return <RecurrenceMock reduce={reduce} />;
    case "voice":
      return <VoiceMock reduce={reduce} />;
  }
}

/**
 * One tab's panel body, keyed by `tabKey` in the parent `AnimatePresence` so mounting a new one
 * (tab switch) crossfades against the previous instance exiting. `TabsContent` needs `forceMount`
 * so Radix doesn't hide/unmount the outgoing panel the instant `active` changes (before its exit
 * animation can play) — but that also means Radix's own `hidden`/tabpanel bookkeeping no longer
 * applies while it's mid-exit. `usePresence()` tells THIS instance whether it's the incoming
 * panel (`isPresent`) or the one animating out; while exiting we override `aria-hidden`/`tabIndex`
 * so a keyboard user tabbing into the panel (the standard Radix trigger → panel flow) can never
 * land on content that's about to unmount — only the active panel stays in the a11y tree and tab
 * order. Applies identically whether the crossfade takes 300ms or (reduced motion) ~0.
 */
function TabPanel({ tabKey, reduce }: { tabKey: TabKey; reduce: boolean }): JSX.Element {
  const [isPresent] = usePresence();
  const tabCopy = copy.features.tabs[tabKey];

  return (
    <TabsContent value={tabKey} forceMount asChild>
      <motion.div
        className="absolute inset-0 overflow-y-auto p-6 md:p-8"
        initial={{ opacity: 0, y: reduce ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: reduce ? 0 : -12 }}
        transition={{ duration: reduce ? 0 : 0.3, ease: "easeOut" }}
        aria-hidden={isPresent ? undefined : true}
        tabIndex={isPresent ? undefined : -1}
      >
        <div className="mb-6 flex flex-col gap-1.5">
          <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
            {tabCopy.title}
          </h3>
          <p className="max-w-md text-sm text-muted-foreground">{tabCopy.blurb}</p>
        </div>

        <TabMock tabKey={tabKey} reduce={reduce} />
      </motion.div>
    </TabsContent>
  );
}

/**
 * Browser-tab style feature switcher — one panel, four surfaces (Day / Calendário / Recorrência /
 * Voz). Radix `Tabs` driven controlled so the active trigger can carry a sliding `layoutId`
 * indicator (shared layout inside `LayoutGroup`) that visually connects to the panel body below,
 * and so the body can crossfade between mock surfaces via `AnimatePresence`.
 *
 * `useReducedMotion()` collapses the indicator slide to an instant jump (`duration: 0`) and the
 * content crossfade to an instant swap (no slide), and kills the per-mock loops (agora pulse,
 * recurrence orbit, waveform pulse). Radix keyboard navigation (arrow keys / roving tabindex) is
 * untouched — only the active trigger's own styling and this indicator are added on top.
 */
export function FeatureTabs(): JSX.Element {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<TabKey>("day");

  return (
    <section className="py-20 md:py-28 w-full">
      <Tabs
        value={active}
        onValueChange={(value) => {
          if (isTabKey(value)) setActive(value);
        }}
        className="gap-5 p-5 bg-black"
      >
        <LayoutGroup>
          <TabsList className="flex w-full justify-between relative z-10 bg-transparent -mb-px rounded-panel h-auto gap-5 p-0">
            {TABS.map(({ key, icon: Icon }) => {
              const isActive = active === key;
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="relative bg-card/30 z-10 flex items-center justify-center text-center gap-2 rounded-4xl border-t border-t-foreground/10 border-r border-r-foreground/10 px-4 py-5 font-mono uppercase tracking-[0.04em] text-muted-foreground shadow-none data-[state=active]:bg-transparent data-[state=active]:text-accent-primary data-[state=active]:shadow-none data-[state=active]:border-none"
                >
                  {isActive && (
                    <motion.span
                      layoutId="tab-active"
                      className={`absolute border-none inset-0 -z-10 rounded-t-4xl bg-surface-panel`}
                      transition={
                        reduce ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.5 }
                      }
                    />
                  )}
                  <Icon className="size-5" aria-hidden="true" />
                  {copy.features.tabs[key].label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </LayoutGroup>

        <div className="relative min-h-168 overflow-hidden rounded-panel border border-highlight bg-surface-panel shadow-panel">
          <AnimatePresence initial={false}>
            <TabPanel key={active} tabKey={active} reduce={Boolean(reduce)} />
          </AnimatePresence>
        </div>
      </Tabs>
    </section>
  );
}
