import { useLayoutEffect, useRef, useState } from "react";

const R = 22;
const NECK = 28;

const r3 = (x: number): number => Math.round(x * 1000) / 1000;

export function buildFooterFramePath(o: {
  w: number;
  h: number;
  R?: number;
  neck?: number;
}): string {
  const { w, h } = o;
  const rad = Math.max(0, Math.min(o.R ?? R, w / 2, h / 2));
  const neck = Math.max(0, Math.min(o.neck ?? NECK, w / 2 - rad, h - rad));
  return [
    `M ${r3(neck + rad)} 0`,
    `H ${r3(w - neck - rad)}`,
    `A ${rad} ${rad} 0 0 1 ${r3(w - neck)} ${r3(rad)}`,
    `V ${r3(h - neck)}`,
    `A ${neck} ${neck} 0 0 0 ${r3(w)} ${r3(h)}`,
    `H 0`,
    `A ${neck} ${neck} 0 0 0 ${r3(neck)} ${r3(h - neck)}`,
    `V ${r3(rad)}`,
    `A ${rad} ${rad} 0 0 1 ${r3(neck + rad)} 0`,
    "Z",
  ].join(" ");
}

type FrameGeom = { w: number; h: number; d: string };

export function useFooterFrameGeometry(): {
  ref: React.RefObject<HTMLElement>;
  geom: FrameGeom | null;
} {
  const ref = useRef<HTMLElement>(null);
  const [geom, setGeom] = useState<FrameGeom | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = (): void => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      setGeom({ w, h, d: buildFooterFramePath({ w, h }) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, geom };
}
