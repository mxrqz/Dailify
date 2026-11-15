import { describe, it, expect } from "vitest";
import { planFeatures } from "./plan-cards";

describe("planFeatures", () => {
  it("anuncia recorrência no free — o bullet que o if por quota escondia", () => {
    expect(planFeatures("free")).toContain("30 tarefas recorrentes");
  });

  it("pro não tem teto de recorrência", () => {
    expect(planFeatures("pro")).toContain("Recorrência ilimitada");
  });

  it("anuncia voz em todos os planos", () => {
    expect(planFeatures("free")).toContain("5 comandos de voz/mês");
    expect(planFeatures("pro")).toContain("30 comandos de voz/mês");
    expect(planFeatures("max")).toContain("300 comandos de voz/mês");
  });

  it("ilimitado usa a frase de ilimitado, não um número", () => {
    expect(planFeatures("max")).toContain("Tarefas ilimitadas");
    expect(planFeatures("max")).toContain("Recorrência ilimitada");
  });

  it("cada plano lista uma linha por quota", () => {
    expect(planFeatures("free")).toHaveLength(3);
    expect(planFeatures("max")).toHaveLength(3);
  });
});
