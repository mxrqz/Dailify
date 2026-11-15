import { describe, expect, it } from "vitest";

import { damp, springStep } from "./spring";

function run(hz: number) {
  const s = { x: 0, v: 0 };
  for (let i = 0; i < hz; i++) springStep(s, 10, 0.1, 1 / hz);
  return s;
}

describe("springStep", () => {
  it("converge pro alvo e dá o mesmo resultado em 60 e 120Hz", () => {
    const a = run(60);
    const b = run(120);
    expect(a.x).toBeCloseTo(10, 2);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.v).toBeCloseTo(b.v, 9);
  });

  it("damp anda metade do caminho numa meia-vida", () => {
    expect(damp(0, 10, 0.2, 0.2)).toBeCloseTo(5, 3);
  });
});
