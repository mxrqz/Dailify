import { describe, expect, it } from "vitest";

import { composeTaskInput } from "./compose-input";
import { parseTaskText } from "./parse-task";

// Quarta-feira, 21 de outubro de 2026, 10:00.
const NOW = new Date(2026, 9, 21, 10, 0);
const at = (day: number, hour: number, month = 9) => new Date(2026, month, day, hour).getTime();

const compose = (text: string, undatedOnly?: boolean) =>
  composeTaskInput(parseTaskText(text, NOW), NOW, { undatedOnly });

describe("composeTaskInput", () => {
  it("horário vai para a agenda", () => {
    const task = compose("reunião qui 16h");
    expect(task.undated).toBeUndefined();
    expect(task.date).toBe(at(22, 16));
    expect(task.alert).toBeUndefined();
    expect(task.repeat).toBe("Off");
  });

  it("sem dia nem horário: Sem data, sem lembrete", () => {
    const task = compose("comprar pão");
    expect(task).toMatchObject({ undated: true, date: NOW.getTime(), repeat: "Off" });
    expect(task.alert).toBeUndefined();
  });

  it("dia sem horário: Sem data com lembrete às 09:00", () => {
    const task = compose("pagar boleto qui");
    expect(task).toMatchObject({ undated: true, date: at(22, 9), alert: at(22, 9) });
  });

  it("toda quarta: série semanal com lembrete", () => {
    const task = compose("regar plantas toda quarta");
    expect(task).toMatchObject({
      undated: true,
      date: at(21, 9),
      alert: at(21, 9),
      repeat: { Weekly: ["Wednesday"] },
    });
  });

  it("todo dia: sem lembrete", () => {
    const task = compose("meditar todo dia");
    expect(task).toMatchObject({ undated: true, date: NOW.getTime(), repeat: "Daily" });
    expect(task.alert).toBeUndefined();
  });

  it("todo dia 5: mensal com lembrete", () => {
    const task = compose("aluguel todo dia 5");
    expect(task).toMatchObject({
      undated: true,
      date: at(5, 9, 10),
      alert: at(5, 9, 10),
      repeat: "Monthly",
    });
  });

  it("recorrente com horário fica na agenda", () => {
    const task = compose("academia toda segunda 7h");
    expect(task.undated).toBeUndefined();
    expect(task).toMatchObject({ date: at(26, 7), repeat: { Weekly: ["Monday"] } });
    expect(task.alert).toBeUndefined();
  });

  it("undatedOnly ignora a hora do parser", () => {
    expect(compose("reunião qui 16h", true)).toMatchObject({
      undated: true,
      date: at(22, 9),
      alert: at(22, 9),
    });
  });
});
