import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The custom sizes, radii, shadows and curves of `global.css`: unregistered, twMerge reads
// `text-subhead` as a color and drops it next to `text-ink-secondary`, and `shadow-raised` as a
// shadow color next to `shadow-ink`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["title-1", "title-3", "body", "subhead", "footnote"],
      radius: ["sheet", "panel", "field"],
      shadow: ["raised", "line", "elevation-1"],
      ease: ["standard", "exit", "spring", "out-expo", "out-quint", "out-soft"],
    },
    // Named layers, durations, widths and the geometry `@utility`s: unregistered, `z-chat` can't
    // replace a sheet's `z-50`, both classes stay and stylesheet order decides.
    classGroups: {
      z: [{ z: ["bar", "float", "chat", "dock", "overlay"] }],
      duration: [{ duration: ["instant", "fast", "base", "slow", "open"] }],
      w: [{ w: ["sheet", "undated"] }],
      "max-w": [{ "max-w": ["bubble"] }],
      "max-h": [{ "max-h": ["sheet"] }],
      h: [{ h: ["bar", "below-bar"] }],
      pb: [{ pb: ["safe", "dock", "dock-clear"] }],
      pt: [{ pt: ["safe"] }],
      top: [{ top: ["safe"] }],
      px: [{ px: ["gutter"] }],
      pr: [{ pr: ["gutter"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Campos opcionais chegam como `unknown` — evita um `as string` por leitura. */
export function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
