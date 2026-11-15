import { describe, expect, it } from "vitest";

import { repeatLabel } from "./repeat-label";

describe("repeatLabel", () => {
  it("não rotula tarefa sem recorrência", () => {
    expect(repeatLabel("Off")).toBe("");
  });

  it("rotula as recorrências fixas", () => {
    expect(repeatLabel("Daily")).toBe("Diária");
    expect(repeatLabel("Monthly")).toBe("Mensal");
    expect(repeatLabel("Yearly")).toBe("Anual");
  });

  it("lista os dias da semanal na ordem da semana", () => {
    expect(repeatLabel({ Weekly: ["Wednesday", "Monday"] })).toBe("Seg, Qua");
  });

  it("põe o intervalo na frente", () => {
    expect(repeatLabel("Daily", 2)).toBe("Dia sim, dia não");
    expect(repeatLabel("Daily", 3)).toBe("A cada 3 dias");
    expect(repeatLabel({ Weekly: ["Wednesday", "Monday"] }, 2)).toBe("A cada 2 semanas (seg, qua)");
    expect(repeatLabel({ Weekly: [] }, 2)).toBe("A cada 2 semanas");
    expect(repeatLabel("Monthly", 3)).toBe("A cada 3 meses");
    expect(repeatLabel("Yearly", 1)).toBe("Anual");
  });

  it("cai no rótulo genérico quando a semanal não tem dia válido", () => {
    expect(repeatLabel({ Weekly: [] })).toBe("Semanal");
    expect(repeatLabel({ Weekly: ["Sextou"] })).toBe("Semanal");
  });
});
