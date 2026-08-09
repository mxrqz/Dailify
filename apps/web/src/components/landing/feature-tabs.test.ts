import { describe, expect, it } from "vitest";

import { buildShellPath } from "./feature-tabs";

describe("buildShellPath", () => {
  it("reproduces mastra.ai's own computed outline for a flush-left active tab", () => {
    // Values lifted straight from mastra.ai's rendered <path> (5 tabs, tab 0 active), rounded to 3dp.
    const d = buildShellPath({
      w: 1046.3166,
      h: 800,
      tabLeft: 0,
      tabRight: 186.863,
      panelTop: 104,
      R: 40,
      tr: 40,
      neck: 64,
    });

    expect(d).toBe(
      "M 40 0 H 146.863 A 40 40 0 0 1 186.863 40 V 40 A 64 64 0 0 0 250.863 104 " +
        "H 1006.317 A 40 40 0 0 1 1046.317 144 V 760 A 40 40 0 0 1 1006.317 800 " +
        "H 40 A 40 40 0 0 1 0 760 V 40 A 40 40 0 0 1 40 0 Z",
    );
  });

  it("flares BOTH sides of a middle tab (two concave necks)", () => {
    const d = buildShellPath({
      w: 900,
      h: 600,
      tabLeft: 400,
      tabRight: 500,
      panelTop: 72,
      neck: 36,
    });
    // sweep-flag 0 arcs are the concave necks
    expect(d.match(/A 36 36 0 0 0/g)).toHaveLength(2);
    expect(d.startsWith("M ")).toBe(true);
    expect(d.endsWith(" Z")).toBe(true);
  });

  it("merges the tab into the wall at the edges (single neck)", () => {
    const left = buildShellPath({
      w: 900,
      h: 600,
      tabLeft: 0,
      tabRight: 210,
      panelTop: 72,
      neck: 36,
    });
    const right = buildShellPath({
      w: 900,
      h: 600,
      tabLeft: 690,
      tabRight: 900,
      panelTop: 72,
      neck: 36,
    });
    expect(left.match(/A 36 36 0 0 0/g)).toHaveLength(1);
    expect(right.match(/A 36 36 0 0 0/g)).toHaveLength(1);
  });
});
