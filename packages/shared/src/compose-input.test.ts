import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";

import { composeTaskInput, fromWire } from "./compose-input";
import { parseTaskText } from "./parse-task";

// Fuso explícito: o resultado não depende do fuso da máquina.
const sp = (year: number, month: number, day: number, hours = 0, minutes = 0) =>
  new TZDate(year, month, day, hours, minutes, 0, 0, "America/Sao_Paulo");

// Quarta-feira, 21 de outubro de 2026, 10:00.
const NOW = sp(2026, 9, 21, 10, 0);
const at = (day: number, hour: number, month = 9) => sp(2026, month, day, hour).getTime();

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

  it("carries the text's tags, and none when there are none", () => {
    expect(compose("comprar pão #casa").tags).toEqual(["casa"]);
    expect(compose("comprar pão").tags).toBeUndefined();
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

  it("dia de hoje sem horário avulso: Sem data sem lembrete", () => {
    const task = compose("pagar boleto hoje");
    expect(task).toMatchObject({ undated: true, date: NOW.getTime() });
    expect(task.alert).toBeUndefined();
  });

  it("toda quarta: série semanal com lembrete", () => {
    const task = compose("regar plantas toda quarta");
    expect(task).toMatchObject({
      undated: true,
      date: at(28, 9),
      alert: at(28, 9),
      repeat: { Weekly: ["Wednesday"] },
    });
  });

  it("dias úteis: série seg–sex com lembrete", () => {
    const task = compose("regar dias úteis");
    expect(task.undated).toBe(true);
    expect(task.repeat).toEqual({
      Weekly: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    });
    expect(task.alert).toBe(task.date);
    expect(task.date).toBe(at(22, 9));
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

describe("fromWire", () => {
  it("dates the AI draft in the given zone, with no unsure reasons or fields", () => {
    const wire = {
      text: "dentista",
      date: at(22, 16),
      hasTime: true,
      hasDay: true,
      duration: null,
      links: [],
      repeat: "Off" as const,
    };
    const parsed = fromWire(wire, "America/Sao_Paulo");
    expect(parsed.date?.getTime()).toBe(at(22, 16));
    expect(parsed.date?.getHours()).toBe(16);
    expect(parsed.unsure).toEqual([]);
    expect(composeTaskInput(parsed, NOW).date).toBe(at(22, 16));
    expect(fromWire({ ...wire, date: null }, "UTC").date).toBeNull();
  });
});
