import { describe, it, expect } from "vitest";
import { planFeatures } from "./plan-cards";

describe("planFeatures", () => {
  it("anuncia créditos de IA em todos os planos", () => {
    expect(planFeatures("free")).toContain("30 créditos de IA/mês");
    expect(planFeatures("pro")).toContain("300 créditos de IA/mês");
    expect(planFeatures("max")).toContain("1.000 créditos de IA/mês");
  });

  it("ilimitado usa a frase de ilimitado, não um número", () => {
    expect(planFeatures("free")).toContain("Tarefas ilimitadas");
    expect(planFeatures("max")).toContain("Tarefas ilimitadas");
  });

  it("cada plano lista uma linha por quota", () => {
    expect(planFeatures("free")).toHaveLength(2);
    expect(planFeatures("max")).toHaveLength(2);
  });
});
