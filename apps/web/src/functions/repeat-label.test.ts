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

  it("cai no rótulo genérico quando a semanal não tem dia válido", () => {
    expect(repeatLabel({ Weekly: [] })).toBe("Semanal");
    expect(repeatLabel({ Weekly: ["Sextou"] })).toBe("Semanal");
  });
});
