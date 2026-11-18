import { describe, it, expect } from "vitest";
import { quotaState } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { creditsLabel, quotaLabel } from "./quota-label";

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

describe("creditsLabel", () => {
  it("hides when unlimited, says exhausted at zero and counts otherwise", () => {
    expect(creditsLabel(quotaState(-1, 3))).toBeNull();
    expect(creditsLabel(quotaState(10, 10))).toBe(copy.mew.exhausted);
    expect(creditsLabel(quotaState(10, 9))).toBe("Créditos de IA · 1 restante");
  });
});
