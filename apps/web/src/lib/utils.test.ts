import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("conhece os tamanhos e raios do global.css: tamanho não briga com cor", () => {
    expect(cn("text-subhead text-ink-secondary")).toBe("text-subhead text-ink-secondary");
    expect(cn("text-subhead", "text-body")).toBe("text-body");
    expect(cn("rounded-t-sheet", "rounded-t-panel")).toBe("rounded-t-panel");
  });

  it.each([
    ["duration-fast", "duration-200"],
    ["ease-standard", "ease-out"],
    ["ease-out-soft", "ease-linear"],
    ["w-sheet", "w-full"],
    ["w-side", "w-0"],
    ["max-w-bubble", "max-w-none"],
    ["max-h-sheet", "max-h-none"],
    ["min-w-duration", "min-w-0"],
    ["scroll-mt-bar", "scroll-mt-0"],
    ["text-subhead", "caps"],
    ["pt-safe", "pt-0"],
    ["h-bar", "h-11"],
    ["px-gutter", "px-4"],
    ["pr-gutter", "pr-0"],
    ["top-safe", "top-0"],
    ["rounded-2xs", "rounded-xs"],
    ["shadow-raised", "shadow-none"],
    ["shadow-raised", "shadow-elevation-1"],
    ["z-overlay", "z-bar"],
    ["z-50", "z-float"],
  ])("lets %s be replaced by %s from the same group", (base, override) => {
    expect(cn(base, override)).toBe(override);
  });

  it("keeps a DS shadow next to a shadow color", () => {
    expect(cn("shadow-raised", "shadow-ink")).toBe("shadow-raised shadow-ink");
  });
});
