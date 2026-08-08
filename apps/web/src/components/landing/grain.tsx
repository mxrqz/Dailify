import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { MeshGradient } from "@paper-design/shaders-react";

import { cn } from "@/lib/utils";

export type GrainProps = {
  /**
   * Mesh spot colors (shader inputs — hex/rgba). Near-monochrome darks by default: the dark spots
   * melt into the surface, the lighter ones become the soft light that wanders across it.
   */
  colors?: string[];
  /** Organic distortion of the spot edges, 0–1. */
  distortion?: number;
  /** Vortex/swirl strength, 0–1 — how much the spots curl as they drift. */
  swirl?: number;
  /** Fine black/white grain overlay on top, 0–1 (softer than raw noise). */
  grain?: number;
  /** Grain mixed into the spot blending, 0–1. */
  grainMixer?: number;
  /** Animation speed; `0` = static. Forced to 0 under prefers-reduced-motion. */
  speed?: number;
  /** Zoom of the mesh, 0.01–4. Bigger = larger, softer spots. */
  scale?: number;
  /** Overlay opacity, 0–1. */
  opacity?: number;
  /** How the effect composites onto what's behind it — `screen` reads well on dark surfaces. */
  blend?: CSSProperties["mixBlendMode"];
  /** Pixel cap — higher = finer grain (and more GPU). */
  maxPixelCount?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Ambient "wandering light + grain" overlay — Paper Shaders' `MeshGradient` (color spots drifting
 * along trajectories) with its `grainOverlay`, wrapped so every knob is a prop; drop it into any
 * positioned container and tune per use site without touching this file (mastra.ai's approach). The
 * WebGL canvas mounts only after it first scrolls into view (`IntersectionObserver`, mount-once) and
 * freezes to a static frame under prefers-reduced-motion. Absolutely-positioned and non-interactive
 * by default; to clip it to a shape, nest it in a clipped parent (e.g. FeatureTabs' shell —
 * `clip-path` clips descendants too).
 *
 * ponytail: default colors are shader inputs (WebGL needs concrete values, not CSS tokens); override
 * `colors` at the use site. `maxPixelCount` is the built-in resolution cap = the grain-fineness knob.
 */
export function Grain({
  colors = ["#141318", "#1b1b22", "#3d3d49", "#4e4e5c"],
  distortion = 0.85,
  swirl = 0.35,
  grain = 0.32,
  grainMixer = 0.1,
  speed = 1.1,
  scale = 1.3,
  opacity = 0.6,
  blend = "screen",
  maxPixelCount = 1_200_000,
  className,
  style,
}: GrainProps): JSX.Element {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect(); // mount once — never unmount, so re-entry never flashes
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{ opacity, mixBlendMode: blend, ...style }}
    >
      {inView && (
        <MeshGradient
          className="h-full w-full"
          colors={colors}
          distortion={distortion}
          swirl={swirl}
          grainOverlay={grain}
          grainMixer={grainMixer}
          scale={scale}
          speed={reduce ? 0 : speed}
          maxPixelCount={maxPixelCount}
          width="100%"
          height="100%"
        />
      )}
    </div>
  );
}
