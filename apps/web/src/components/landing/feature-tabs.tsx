import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Columns3, Mic, RotateCw, type LucideIcon } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copy } from "./copy";
import { Grain } from "./grain";
import { CalendarTab } from "./tabs/calendar-tab";
import { DayTab } from "./tabs/day-tab";
import { RecurrenceTab } from "./tabs/recurrence-tab";
import { useShellGeometry } from "./tabs/shell-path";
import { VoiceTab } from "./tabs/voice-tab";

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

/** Renders the active tab's content — day/calendar are bleeding scenes, recurrence/voice legacy. */
function TabPanel({ active, reduce }: { active: TabKey; reduce: boolean }): JSX.Element {
  switch (active) {
    case "day":
      return <DayTab />;
    case "calendar":
      return <CalendarTab />;
    case "recurrence":
      return <RecurrenceTab reduce={reduce} />;
    case "voice":
      return <VoiceTab reduce={reduce} />;
  }
}

/**
 * Feature switcher whose active tab melts into the panel via a single computed SVG outline
 * (fill = `clip-path`, border = stroked `<path>`) joined by concave "neck" arcs — mastra.ai's
 * folder-tab connection that fills the gap between the tab row and the panel. Radix `Tabs` still
 * drives state + keyboard nav (arrow keys / roving tabindex); the outline snaps to the active tab
 * (no slide, matching mastra) while the panel body crossfades via `AnimatePresence`.
 *
 * `useReducedMotion()` collapses the content crossfade to an instant swap and kills the per-mock
 * loops (recurrence orbit, waveform pulse).
 */
export function FeatureTabs(): JSX.Element {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<TabKey>("day");
  const { ref: shellRef, geom } = useShellGeometry(active);

  return (
    <section className="w-full px-gutter section-y">
      <Tabs
        value={active}
        onValueChange={(value) => {
          if (isTabKey(value)) setActive(value);
        }}
        className="rounded-4xl bg-black p-5"
      >
        <div ref={shellRef} className="relative grid gap-4">
          {geom && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-0 bg-background"
                style={{ clipPath: `path('${geom.d}')` }}
              >
                <Grain preset="aurora" />
              </div>
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-1 h-full w-full overflow-visible"
                viewBox={`0 0 ${geom.w} ${geom.h}`}
              >
                <path
                  d={geom.d}
                  fill="none"
                  stroke="var(--border-highlight)"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </>
          )}

          <TabsList className="relative z-10 flex h-auto w-full justify-between gap-5 bg-transparent p-0">
            {TABS.map(({ key, icon: Icon }) => (
              <TabsTrigger
                key={key}
                value={key}
                className="relative flex h-14 items-center justify-center gap-2 rounded-full border border-transparent px-4 font-mono uppercase tracking-[0.04em] text-muted-foreground shadow-none data-[state=active]:border-transparent dark:data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:text-accent-primary data-[state=active]:shadow-none data-[state=inactive]:border-highlight data-[state=inactive]:bg-surface-card"
              >
                <Icon className="size-5" aria-hidden="true" />
                {copy.features.tabs[key].label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="relative z-10 min-h-168">
            <AnimatePresence initial={false}>
              <motion.div
                key={active}
                role="tabpanel"
                aria-label={copy.features.tabs[active].label}
                className={"absolute inset-0 overflow-hidden rounded-3xl"}
                initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -12 }}
                transition={{ duration: reduce ? 0 : 0.3, ease: "easeOut" }}
              >
                <TabPanel active={active} reduce={Boolean(reduce)} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Tabs>
    </section>
  );
}
