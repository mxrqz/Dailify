import { describe, expect, it } from "vitest";

import { dockProgress, dockTransform } from "./strip-dock";

describe("dockProgress", () => {
  it("runs 0 to 1 over the bar's last 52px, clamped", () => {
    expect(dockProgress(200, 76)).toBe(0);
    expect(dockProgress(50, 76)).toBe(0.5);
    expect(dockProgress(24, 76)).toBe(1);
    expect(dockProgress(-40, 76)).toBe(1);
  });

  it("stays 0 where the bar is hidden (desktop)", () => {
    expect(dockProgress(60, 0)).toBe(0);
  });
});

describe("dockTransform", () => {
  const box = { left: 16, width: 380 };
  const slot = { left: 60, right: 345 };

  it("is the identity in the flow", () => {
    expect(dockTransform(0, box, slot)).toBe("translate(0px, 0px) scale(1)");
  });

  it("docked, fits the slot and centers the pills on the bar", () => {
    // s = 285 / 380 = 0.75: pills 39px tall, from 26 - 19.5 under the bar's top.
    expect(dockTransform(1, box, slot)).toBe("translate(44px, -1.5px) scale(0.75)");
  });
});
