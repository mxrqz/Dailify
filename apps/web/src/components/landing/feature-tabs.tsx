import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Columns3, Mic, RotateCw, type LucideIcon } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { copy } from "./copy";
import { Grain } from "./grain";
import { CalendarAppWindow } from "./mocks/calendar-app-window";
import { DayAppWindow } from "./mocks/day-app-window";
import { TaskDetailSheet } from "./mocks/task-detail-sheet";
import { TabScene } from "./tab-scene";

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

function TabMock({
  tabKey,
  reduce,
}: {
  tabKey: Exclude<TabKey, "day" | "calendar">;
  reduce: boolean;
}): JSX.Element {
  switch (tabKey) {
    case "recurrence":
      return <RecurrenceMock reduce={reduce} />;
    case "voice":
      return <VoiceMock reduce={reduce} />;
  }
}

/**
 * Pure panel content for one tab — the animated wrapper + keying live in `FeatureTabs`. Deliberately
 * free of `motion`/`usePresence`: the panel is animated by a `motion.div` that is the DIRECT keyed
 * child of `AnimatePresence`. The previous design keyed a custom component that called `usePresence()`
 * but never called its `safeToRemove()`; per framer's docs that registers an exit-blocking id that
 * never releases, so the outgoing panel never finishes exiting and, on RETURN to a tab,
 * `AnimatePresence` never re-mounts it fresh → the panel renders blank (the "only loads the first
 * time" bug). Framer's rule: the key belongs on the motion element, and manual `usePresence` MUST
 * call `safeToRemove`. So we key the motion.div directly and let framer auto-manage exit.
 */
function TabPanelBody({ tabKey, reduce }: { tabKey: TabKey; reduce: boolean }): JSX.Element {
  const tabCopy = copy.features.tabs[tabKey];

  if (tabKey === "day") {
    return (
      <TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
        <div className="absolute bottom-0 left-16 h-3/5 w-1/2">
          <TaskDetailSheet />
        </div>

        <div className="absolute bottom-0 -right-5 w-1/2">
          <DayAppWindow />
        </div>
      </TabScene>
    );
  }

  if (tabKey === "calendar") {
    return (
      <TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
        {/* peek do dia 14 (hoje) por cima, à esquerda — reusa a janela de dia menor */}
        <div className="absolute bottom-0 left-16 h-3/5 w-1/2">
          <DayAppWindow date="Qui · 14 Ago" className="h-full" />
        </div>

        {/* mês sangrando pra direita — a janela grande */}
        <div className="absolute bottom-0 -right-5 w-1/2">
          <CalendarAppWindow />
        </div>
      </TabScene>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-1.5">
        <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
          {tabCopy.title}
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">{tabCopy.blurb}</p>
      </div>

      <TabMock tabKey={tabKey} reduce={reduce} />
    </>
  );
}

// ─── Shell geometry ─────────────────────────────────────────────────────────
// The tab row + panel are drawn as ONE outline: a rounded panel with the active tab raised as a
// bump on top, joined by concave "neck" arcs (negative radius). The SAME path clips the fill and
// strokes the border — mastra.ai's technique. `buildShellPath` was reverse-engineered from their
// own computed <path> and is pinned to it in feature-tabs.test.ts. ponytail: radii/gap hardcoded
// as design constants; tune visually.
const PANEL_R = 22; // panel corner radius (~ --radius-panel)
const TAB_R = 20; // active-tab top corner radius
const NECK = 36; // concave flare radius joining tab → panel
const GAP = 16; // intentional gap between tab row and panel (px); the neck bridges it — keep in sync with `gap-4`

const r3 = (x: number): number => Math.round(x * 1000) / 1000;

/** SVG outline for the shell: rounded panel + active-tab bump joined by concave necks. */
export function buildShellPath(o: {
  w: number;
  h: number;
  tabLeft: number;
  tabRight: number;
  panelTop: number;
  R?: number;
  tr?: number;
  neck?: number;
}): string {
  const { w, h, tabLeft, tabRight, panelTop } = o;
  const R = o.R ?? PANEL_R;
  const tr = Math.min(o.tr ?? TAB_R, (tabRight - tabLeft) / 2);
  const neck = Math.max(0, Math.min(o.neck ?? NECK, panelTop - tr));
  const flushL = tabLeft - neck < R; // active tab hugs the shell's left edge → merge, no left neck
  const flushR = tabRight + neck > w - R; // ... right edge
  const tabTR = flushR ? w : tabRight; // x of the tab's top-right corner
  const p: string[] = [];

  // left approach + tab top-left corner
  if (flushL) {
    p.push(`M ${r3(tr)} 0`);
  } else {
    p.push(`M ${R} ${r3(panelTop)}`);
    p.push(`H ${r3(tabLeft - neck)}`);
    p.push(`A ${neck} ${neck} 0 0 0 ${r3(tabLeft)} ${r3(panelTop - neck)}`); // left neck up (concave)
    p.push(`V ${tr}`);
    p.push(`A ${tr} ${tr} 0 0 1 ${r3(tabLeft + tr)} 0`); // convex
  }
  // tab flat top + top-right corner
  p.push(`H ${r3(tabTR - tr)}`);
  p.push(`A ${tr} ${tr} 0 0 1 ${r3(tabTR)} ${tr}`);
  // right approach: neck down into panel, or straight wall if flush
  if (!flushR) {
    p.push(`V ${r3(panelTop - neck)}`);
    p.push(`A ${neck} ${neck} 0 0 0 ${r3(tabRight + neck)} ${r3(panelTop)}`); // right neck down (concave)
    p.push(`H ${r3(w - R)}`);
    p.push(`A ${R} ${R} 0 0 1 ${r3(w)} ${r3(panelTop + R)}`);
  }
  // right wall → bottom edge → bottom-left corner
  p.push(`V ${r3(h - R)}`);
  p.push(`A ${R} ${R} 0 0 1 ${r3(w - R)} ${r3(h)}`);
  p.push(`H ${R}`);
  p.push(`A ${R} ${R} 0 0 1 0 ${r3(h - R)}`);
  // left wall close
  if (flushL) {
    p.push(`V ${tr}`);
    p.push(`A ${tr} ${tr} 0 0 1 ${r3(tr)} 0`);
  } else {
    p.push(`V ${r3(panelTop + R)}`);
    p.push(`A ${R} ${R} 0 0 1 ${R} ${r3(panelTop)}`);
  }
  p.push("Z");
  return p.join(" ");
}

type ShellGeom = { w: number; h: number; d: string };

/** Measure the shell + active trigger, recompute the outline on tab-change / resize. */
function useShellGeometry(active: TabKey): {
  ref: React.RefObject<HTMLDivElement>;
  geom: ShellGeom | null;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [geom, setGeom] = useState<ShellGeom | null>(null);

  useLayoutEffect(() => {
    const shell = ref.current;
    if (!shell) return;
    const measure = (): void => {
      const trigger = shell.querySelector<HTMLElement>(
        '[data-slot="tabs-trigger"][data-state="active"]',
      );
      if (!trigger) return;
      const s = shell.getBoundingClientRect();
      const t = trigger.getBoundingClientRect();
      setGeom({
        w: s.width,
        h: s.height,
        d: buildShellPath({
          w: s.width,
          h: s.height,
          tabLeft: t.left - s.left,
          tabRight: t.right - s.left,
          panelTop: t.height + GAP,
        }),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(shell);
    return () => ro.disconnect();
  }, [active]);

  return { ref, geom };
}

/**
 * Feature switcher whose active tab melts into the panel via a single computed SVG outline
 * (fill = `clip-path`, border = stroked `<path>`) joined by concave "neck" arcs — mastra.ai's
 * folder-tab connection that fills the gap between the tab row and the panel. Radix `Tabs` still
 * drives state + keyboard nav (arrow keys / roving tabindex); the outline snaps to the active tab
 * (no slide, matching mastra) while the panel body crossfades via `AnimatePresence`.
 *
 * `useReducedMotion()` collapses the content crossfade to an instant swap and kills the per-mock
 * loops (agora pulse, recurrence orbit, waveform pulse).
 */
export function FeatureTabs(): JSX.Element {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<TabKey>("day");
  const { ref: shellRef, geom } = useShellGeometry(active);

  return (
    <section className="w-full px-gutter py-20 md:py-28">
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
                className={cn(
                  "absolute inset-0 rounded-3xl overflow-hidden",
                  active === "day" ? "overflow-hidden" : "overflow-y-auto",
                )}
                initial={{ opacity: 0, y: reduce ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -12 }}
                transition={{ duration: reduce ? 0 : 0.3, ease: "easeOut" }}
              >
                <TabPanelBody tabKey={active} reduce={Boolean(reduce)} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Tabs>
    </section>
  );
}
