import { useLayoutEffect, useRef, useState } from "react";

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
export function useShellGeometry(active: string): {
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
