import { describe, it, expect } from "vitest";

import { buildFooterFramePath } from "./footer-frame";

describe("buildFooterFramePath", () => {
  it("cantos de cima convexos (sweep 1), de baixo côncavos (sweep 0)", () => {
    const d = buildFooterFramePath({ w: 400, h: 200, R: 22, neck: 28 });
    expect(d.startsWith("M 22 0")).toBe(true); // começa após o canto convexo topo-esquerda
    expect(d).toContain("A 22 22 0 0 1 400 22"); // canto convexo topo-direita
    expect(d).toContain("A 28 28 0 0 0 372 200"); // mordida baixo-direita
    expect(d).toContain("A 28 28 0 0 0 0 172"); // mordida baixo-esquerda
    expect(d.endsWith("Z")).toBe(true);
  });

  it("clampa neck/R em containers pequenos (sem NaN, sem raio maior que a metade)", () => {
    const d = buildFooterFramePath({ w: 20, h: 20, R: 22, neck: 28 });
    expect(d).not.toContain("NaN");
    expect(d).toContain("A 10 10"); // R e neck clampados a w/2 = 10
  });
});
