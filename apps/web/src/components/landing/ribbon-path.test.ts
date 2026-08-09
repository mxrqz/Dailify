import { describe, expect, it } from "vitest";

import { buildRibbonPath } from "./ribbon-path";

describe("buildRibbonPath", () => {
  it("traces the zigzag ribbon for a canonical 3-col layout", () => {
    // A (top, cols1-2) x[0,220] y[0,120] · B (mid, cols2-3) x[120,340] y[140,260]
    // · C (bot, cols1-2) x[0,220] y[280,400]. Spine = col2 [120,220], full height.
    const d = buildRibbonPath({
      w: 340,
      h: 400,
      aR: 220,
      aB: 120,
      bL: 120,
      bT: 140,
      bB: 260,
      cT: 280,
      R: 20,
      neck: 28,
    });

    expect(d).toBe(
      "M 20 0 H 200 A 20 20 0 0 1 220 20 V 112 A 28 28 0 0 0 248 140 " +
        "H 320 A 20 20 0 0 1 340 160 V 240 A 20 20 0 0 1 320 260 " +
        "H 248 A 28 28 0 0 0 220 288 V 380 A 20 20 0 0 1 200 400 " +
        "H 20 A 20 20 0 0 1 0 380 V 300 A 20 20 0 0 1 20 280 " +
        "H 92 A 28 28 0 0 0 120 252 V 148 A 28 28 0 0 0 92 120 " +
        "H 20 A 20 20 0 0 1 0 100 V 20 A 20 20 0 0 1 20 0 Z",
    );
  });

  it("has exactly 4 concave necks (sweep-flag 0 arcs) and closes", () => {
    const d = buildRibbonPath({
      w: 340,
      h: 400,
      aR: 220,
      aB: 120,
      bL: 120,
      bT: 140,
      bB: 260,
      cT: 280,
    });
    expect(d.match(/A 32 32 0 0 0/g)).toHaveLength(4);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
  });
});
