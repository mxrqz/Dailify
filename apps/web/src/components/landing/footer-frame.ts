import { useLayoutEffect, useRef, useState } from "react";

const R = 22; // raio convexo dos cantos de cima (= --radius-panel)
const NECK = 28; // raio côncavo dos cantos de baixo (a mordida invertida)

const r3 = (x: number): number => Math.round(x * 1000) / 1000;

/** Outline SVG: retângulo w×h, cantos de cima convexos, cantos de baixo côncavos (invertidos). */
export function buildFooterFramePath(o: {
  w: number;
  h: number;
  R?: number;
  neck?: number;
}): string {
  const { w, h } = o;
  const rad = Math.max(0, Math.min(o.R ?? R, w / 2, h / 2));
  const neck = Math.max(0, Math.min(o.neck ?? NECK, w / 2, h - rad));
  return [
    `M ${r3(rad)} 0`,
    `H ${r3(w - rad)}`,
    `A ${rad} ${rad} 0 0 1 ${r3(w)} ${r3(rad)}`, // canto convexo topo-direita
    `V ${r3(h - neck)}`,
    `A ${neck} ${neck} 0 0 0 ${r3(w - neck)} ${r3(h)}`, // mordida côncava baixo-direita (centro em w,h)
    `H ${r3(neck)}`,
    `A ${neck} ${neck} 0 0 0 0 ${r3(h - neck)}`, // mordida côncava baixo-esquerda (centro em 0,h)
    `V ${r3(rad)}`,
    `A ${rad} ${rad} 0 0 1 ${r3(rad)} 0`, // canto convexo topo-esquerda
    "Z",
  ].join(" ");
}

type FrameGeom = { w: number; h: number; d: string };

/** Mede a `<footer>` e reconstrói o outline no resize (o path escala em px, não em viewBox). */
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
