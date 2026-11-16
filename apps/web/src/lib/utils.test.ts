import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("conhece os tamanhos e raios do global.css: tamanho não briga com cor", () => {
    expect(cn("text-subhead text-ink-secondary")).toBe("text-subhead text-ink-secondary");
    expect(cn("text-subhead", "text-body")).toBe("text-body");
    expect(cn("rounded-t-sheet", "rounded-t-panel")).toBe("rounded-t-panel");
  });
});
