import { useLayoutEffect, useRef, useState } from "react";

// ─── Ribbon geometry ─────────────────────────────────────────────────────────
// The three WIDE bento cells (calendar / recurrence / voice) are drawn as ONE connected outline:
// a vertical spine down the shared middle column plus three rectangular appendages (top-left,
// mid-right, bottom-left), joined by concave "neck" arcs (negative radius) that bridge the grid
// gaps between rows. The SAME path clips the fill and strokes the border — the tabs shell trick
// (see tabs/shell-path.ts), generalised from "panel + one bump" to a 3-rect zigzag with 4 necks.
// ponytail: radii hardcoded design constants; tune visually.
const R = 22; // convex outer-corner radius (= --radius-panel, matches the cards & tabs shell)
const NECK = 32; // concave neck radius at the 4 reentrant corners

const r3 = (x: number): number => Math.round(x * 1000) / 1000;

/**
 * SVG outline for the connected wide-cell ribbon. Inputs are the measured edges of the three wide
 * cells laid out as a zigzag: A (top, cols 1-2), B (mid, cols 2-3), C (bottom, cols 1-2). A and C
 * share the left edge (0) and right edge (`aR`); B runs from `bL` to the container right (`w`); the
 * spine is the shared middle column `[bL, aR]`, solid top (0) to bottom (`h`). The 4 concave necks
 * sit at (aR,bT) (aR,bB) (bL,cT) (bL,aB) — the reentrant corners where an appendage meets the spine.
 */
export function buildRibbonPath(o: {
  w: number;
  h: number;
  aR: number; // right edge of A/C (col-2 right)
  aB: number; // bottom of A
  bL: number; // left edge of B (col-2 left)
  bT: number; // top of B
  bB: number; // bottom of B
  cT: number; // top of C
  R?: number;
  neck?: number;
}): string {
  const { w, h, aR, aB, bL, bT, bB, cT } = o;
  const rad = o.R ?? R;
  const neck = Math.max(
    0,
    Math.min(o.neck ?? NECK, bT - rad, w - rad - aR, h - rad - bB, bL - rad, (cT - aB) / 2),
  );
  return [
    `M ${rad} 0`,
    `H ${r3(aR - rad)}`,
    `A ${rad} ${rad} 0 0 1 ${r3(aR)} ${rad}`, // A top-right (convex)
    `V ${r3(bT - neck)}`,
    `A ${neck} ${neck} 0 0 0 ${r3(aR + neck)} ${r3(bT)}`, // neck → B top (concave)
    `H ${r3(w - rad)}`,
    `A ${rad} ${rad} 0 0 1 ${r3(w)} ${r3(bT + rad)}`, // B top-right (convex)
    `V ${r3(bB - rad)}`,
    `A ${rad} ${rad} 0 0 1 ${r3(w - rad)} ${r3(bB)}`, // B bottom-right (convex)
    `H ${r3(aR + neck)}`,
    `A ${neck} ${neck} 0 0 0 ${r3(aR)} ${r3(bB + neck)}`, // neck → spine (concave)
    `V ${r3(h - rad)}`,
    `A ${rad} ${rad} 0 0 1 ${r3(aR - rad)} ${r3(h)}`, // spine bottom-right (convex)
    `H ${rad}`,
    `A ${rad} ${rad} 0 0 1 0 ${r3(h - rad)}`, // bottom-left (convex)
    `V ${r3(cT + rad)}`,
    `A ${rad} ${rad} 0 0 1 ${rad} ${r3(cT)}`, // C top-left (convex)
    `H ${r3(bL - neck)}`,
    `A ${neck} ${neck} 0 0 0 ${r3(bL)} ${r3(cT - neck)}`, // neck → spine (concave)
    `V ${r3(aB + neck)}`,
    `A ${neck} ${neck} 0 0 0 ${r3(bL - neck)} ${r3(aB)}`, // neck → A bottom (concave)
    `H ${rad}`,
    `A ${rad} ${rad} 0 0 1 0 ${r3(aB - rad)}`, // A bottom-left (convex)
    `V ${rad}`,
    `A ${rad} ${rad} 0 0 1 ${rad} 0`, // A top-left (convex)
    "Z",
  ].join(" ");
}

type RibbonGeom = { w: number; h: number; d: string };

/**
 * Measure the grid + its three `[data-ribbon-cell]` wide cells and rebuild the outline on resize.
 * Uses `offset*` (layout box, transform-agnostic) so the scroll-reveal transform on the cells never
 * poisons the measurement. Returns `null` until measured / when fewer than 3 wide cells exist
 * (mobile single-column stack, where the ribbon is hidden anyway).
 */
export function useRibbonGeometry(): {
  ref: React.RefObject<HTMLDivElement>;
  geom: RibbonGeom | null;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [geom, setGeom] = useState<RibbonGeom | null>(null);

  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const measure = (): void => {
      const cells = Array.from(grid.querySelectorAll<HTMLElement>("[data-ribbon-cell]"));
      if (cells.length < 3) return;
      const [A, B, C] = cells
        .map((c) => ({
          left: c.offsetLeft,
          top: c.offsetTop,
          right: c.offsetLeft + c.offsetWidth,
          bottom: c.offsetTop + c.offsetHeight,
        }))
        .sort((a, b) => a.top - b.top);
      const w = grid.clientWidth;
      const h = grid.clientHeight;
      setGeom({
        w,
        h,
        d: buildRibbonPath({
          w,
          h,
          aR: A.right,
          aB: A.bottom,
          bL: B.left,
          bT: B.top,
          bB: B.bottom,
          cT: C.top,
        }),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, []);

  return { ref, geom };
}
