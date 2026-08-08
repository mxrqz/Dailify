import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { MeshGradient } from "@paper-design/shaders-react";

import { cn } from "@/lib/utils";

/** Tunable shader params — all optional; unset ones fall back to the preset, then the base look. */
export type GrainParams = {
  /** Mesh spot colors (hex/rgba). Not limited to greys — pass any palette for a colourful field. */
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
};

/** Shared look; a preset and then any explicit prop override on top. */
const BASE: Required<GrainParams> = {
  colors: ["#141318", "#1b1b22", "#3d3d49", "#4e4e5c"],
  distortion: 0.85,
  swirl: 0.35,
  grain: 0.32,
  grainMixer: 0.1,
  speed: 1.1,
  scale: 1.3,
  opacity: 0.6,
  blend: "screen",
  maxPixelCount: 1_200_000,
};

/**
 * Named looks — pass `preset="…"`; any explicit prop still wins over the preset. Add your own here.
 * ponytail: colours are shader inputs (WebGL needs concrete values), not CSS tokens.
 */
export const grainPresets = {
  /** Soft light spots wandering across the dark surface — the holographic default. */
  aurora: { colors: ["#141318", "#1b1b22", "#3d3d49", "#4e4e5c"], opacity: 0.6 },
  /** The negative: dark spots drifting across a faintly lit field. */
  eclipse: { colors: ["#3c3c46", "#44444f", "#4c4c58", "#101015"], opacity: 0.45 },
} satisfies Record<string, Partial<GrainParams>>;

export type GrainPreset = keyof typeof grainPresets;

export type GrainProps = GrainParams & {
  /** Named starting look (default `"aurora"`). Any param prop below overrides it. */
  preset?: GrainPreset;
  className?: string;
  style?: CSSProperties;
};

/**
 * Ambient "wandering light + grain" overlay — Paper Shaders' `MeshGradient` (colour spots drifting
 * along trajectories) with its `grainOverlay`. Pick a `preset` or pass any param (colours — greyscale
 * or colourful —, speed, fineness…) at the use site without touching this file; drop it into any
 * positioned container. The WebGL canvas mounts only after it first scrolls into view
 * (`IntersectionObserver`, mount-once) and freezes to a static frame under prefers-reduced-motion.
 * Clip it by nesting in a clipped parent (e.g. FeatureTabs' shell — `clip-path` clips descendants).
 */
export function Grain({ preset = "aurora", className, style, ...rest }: GrainProps): JSX.Element {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const cfg = { ...BASE, ...grainPresets[preset], ...rest };

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
      style={{ opacity: cfg.opacity, mixBlendMode: cfg.blend, ...style }}
    >
      {inView && (
        <MeshGradient
          className="h-full w-full"
          colors={cfg.colors}
          distortion={cfg.distortion}
          swirl={cfg.swirl}
          grainOverlay={cfg.grain}
          grainMixer={cfg.grainMixer}
          scale={cfg.scale}
          speed={reduce ? 0 : cfg.speed}
          maxPixelCount={cfg.maxPixelCount}
          width="100%"
          height="100%"
        />
      )}
    </div>
  );
}
