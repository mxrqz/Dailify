import { describe, it, expect } from "vitest";
import { planFeatures } from "./pricing";

describe("planFeatures", () => {
  it("Free = 30/mês, sem recorrência, sem voz", () => {
    const f = planFeatures("free").join(" | ").toLowerCase();
    expect(f).toContain("30");
    expect(f).not.toContain("ilimitad");
    expect(f).not.toContain("voz");
  });
  it("Pro = 300/mês + recorrência ilimitada, sem voz", () => {
    const f = planFeatures("pro").join(" | ").toLowerCase();
    expect(f).toContain("300");
    expect(f).toContain("recorr");
    expect(f).not.toContain("voz");
  });
  it("Pro+AI = inclui voz", () => {
    expect(planFeatures("pro+ai").join(" | ").toLowerCase()).toContain("voz");
  });
});
