import { describe, it, expect } from "vitest";
import { copy } from "./copy";

describe("dashboard copy", () => {
  it("tem todas as seções e nenhuma string vazia", () => {
    for (const section of ["header", "day", "aside", "task"] as const) {
      expect(copy[section]).toBeTruthy();
    }
    expect(JSON.stringify(copy)).not.toMatch(/""/);
  });

  it("está em pt-BR — nenhuma das strings em inglês que o dashboard tinha", () => {
    const flat = JSON.stringify(copy).toLowerCase();
    for (const english of ["today's tasks", "new task", "upcoming task", "edit task"]) {
      expect(flat).not.toContain(english);
    }
  });

  it("não hard-coda limite de plano (vem de QUOTAS)", () => {
    expect(JSON.stringify(copy)).not.toMatch(/\d+ tarefas/);
  });
});
