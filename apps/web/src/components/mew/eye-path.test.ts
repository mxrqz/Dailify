import { describe, expect, it } from "vitest";

import { eyePath } from "./eye-path";

describe("eyePath", () => {
  it("m=0 é a elipse: topo, lado e base nos extremos", () => {
    const d = eyePath(100, 100, 50, 40, 0);
    expect(d.startsWith("M100.0 60.0C")).toBe(true);
    expect(d).toContain(" 150.0 100.0C");
    expect(d).toContain(" 100.0 140.0C");
    expect(d.endsWith(" 100.0 60.0Z")).toBe(true);
  });

  it("m=1 é o '^': topo baixa e nada passa abaixo de cy + 0.32·ry", () => {
    const d = eyePath(100, 100, 50, 40, 1);
    expect(d.startsWith("M100.0 83.2C")).toBe(true);
    const ys = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => Number(m[2]));
    expect(Math.max(...ys)).toBeCloseTo(112.8, 1);
    expect(d.match(/C/g)).toHaveLength(4);
  });
});
