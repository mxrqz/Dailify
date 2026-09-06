import { describe, it, expect } from "vitest";
import { quotaState } from "@dailify/shared";
import { quotaLabel } from "./quota-label";

describe("quotaLabel", () => {
  it("finito mostra os dois números", () => {
    expect(quotaLabel(quotaState(30, 12), "Tarefas")).toBe("12 de 30 Tarefas");
  });

  it("ilimitado troca o teto pela palavra, e ainda diz quanto foi usado", () => {
    expect(quotaLabel(quotaState(-1, 47), "Tarefas")).toBe("47 Tarefas · ilimitado");
  });

  it("bloqueado mostra zero de zero", () => {
    expect(quotaLabel(quotaState(0, 0), "Voz")).toBe("0 de 0 Voz");
  });
});
