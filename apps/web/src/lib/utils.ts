import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The custom sizes, radii, shadows and curves of `global.css`: unregistered, twMerge reads
// `text-subhead` as a color and drops it next to `text-ink-secondary`, and `shadow-raised` as a
// shadow color next to `shadow-ink`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["title-1", "title-3", "body", "subhead", "footnote"],
      radius: ["2xs", "sheet", "panel", "field"],
      shadow: ["raised", "line", "elevation-1"],
      ease: ["standard", "exit", "spring", "out-expo", "out-quint", "out-soft"],
    },
    // Named layers, durations, widths and the geometry `@utility`s: unregistered, `z-chat` can't
    // replace a sheet's `z-50`, both classes stay and stylesheet order decides.
    classGroups: {
      // `caps` carries its own size, so it replaces a Button's `text-subhead`.
      "font-size": ["caps"],
      z: [{ z: ["bar", "float", "chat", "dock", "overlay"] }],
      duration: [{ duration: ["instant", "fast", "base", "slow", "open"] }],
      w: [{ w: ["sheet", "side"] }],
      "max-w": [{ "max-w": ["bubble"] }],
      "max-h": [{ "max-h": ["sheet"] }],
      "min-w": [{ "min-w": ["duration"] }],
      "scroll-mt": [{ "scroll-mt": ["bar", "agenda"] }],
      h: [{ h: ["bar"] }],
      pb: [{ pb: ["safe", "dock", "dock-clear"] }],
      pt: [{ pt: ["safe"] }],
      top: [{ top: ["safe", "bar"] }],
      px: [{ px: ["gutter"] }],
      pr: [{ pr: ["gutter"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
