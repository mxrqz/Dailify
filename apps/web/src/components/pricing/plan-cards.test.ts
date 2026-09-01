import { describe, it, expect } from "vitest";
import { planFeatures } from "./plan-cards";

describe("planFeatures", () => {
  it("anuncia recorrência no free — o bullet que o if por quota escondia", () => {
    expect(planFeatures("free")).toContain("3 tarefas recorrentes");
  });

  it("anuncia recorrência no pro", () => {
    expect(planFeatures("pro")).toContain("30 tarefas recorrentes");
  });

  it("anuncia voz em todos os planos", () => {
    expect(planFeatures("free")).toContain("3 comandos de voz/mês");
    expect(planFeatures("pro")).toContain("5 comandos de voz/mês");
    expect(planFeatures("pro+ai")).toContain("200 comandos de voz/mês");
  });

  it("ilimitado usa a frase de ilimitado, não um número", () => {
    expect(planFeatures("pro+ai")).toContain("Tarefas ilimitadas");
    expect(planFeatures("pro+ai")).toContain("Recorrência ilimitada");
  });

  it("cada plano lista uma linha por quota", () => {
    expect(planFeatures("free")).toHaveLength(3);
    expect(planFeatures("pro+ai")).toHaveLength(3);
  });
});
