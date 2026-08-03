import { describe, it, expect } from "vitest";
import { copy } from "./copy";

describe("landing copy", () => {
  it("tem todas as seções e nenhuma string vazia", () => {
    for (const section of [
      "nav",
      "hero",
      "features",
      "bento",
      "howItWorks",
      "pricing",
      "cta",
      "footer",
    ] as const) {
      expect(copy[section]).toBeTruthy();
    }
    const flat = JSON.stringify(copy);
    expect(flat).not.toMatch(/""/); // nenhuma string vazia
  });

  it("hero tem headline em 3 partes e 2 CTAs", () => {
    expect(copy.hero.titleAccent.length).toBeGreaterThan(0);
    expect(copy.hero.ctaPrimary.length).toBeGreaterThan(0);
    expect(copy.hero.ctaSecondary.length).toBeGreaterThan(0);
  });

  it("não menciona planos/textos falsos removidos", () => {
    const flat = JSON.stringify(copy).toLowerCase();
    expect(flat).not.toContain("team");
    expect(flat).not.toContain("10 daily");
  });
});
