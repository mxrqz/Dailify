import { describe, expect, it } from "vitest";

import { fromWire, onDay, withEdits } from "./compose-input";
import { composeTaskInput, parseTaskText } from "@dailify/shared";
import { zonedAt } from "./zone";

// Quarta-feira, 21 de outubro de 2026, 10:00.
const NOW = zonedAt(2026, 9, 21, 10, 0);
const at = (day: number, hour: number, month = 9) => new Date(2026, month, day, hour).getTime();

describe("onDay", () => {
  const day = new Date(2026, 10, 12);

  it("põe a hora da frase no dia escolhido", () => {
    const parsed = onDay(parseTaskText("reunião 15h", NOW), day);
    expect(parsed.date).toEqual(new Date(2026, 10, 12, 15));
    expect(parsed.hasDay).toBe(true);
  });

  it("frase com dia próprio ganha do calendário", () => {
    const parsed = parseTaskText("reunião amanhã 15h", NOW);
    expect(onDay(parsed, day)).toBe(parsed);
  });

  it("sem hora vira Sem data com lembrete no dia", () => {
    const input = composeTaskInput(onDay(parseTaskText("dentista", NOW), day), NOW);
    expect(input.undated).toBe(true);
    expect(input.alert).toBe(new Date(2026, 10, 12, 9).getTime());
  });
});

describe("fromWire", () => {
  it("epoch vira Date e o rascunho compõe como a frase local", () => {
    const wire = {
      text: "reunião",
      date: at(22, 16),
      hasTime: true,
      hasDay: true,
      duration: "1h",
      links: [],
      repeat: "Off" as const,
    };
    const parsed = fromWire(wire);
    expect(parsed.date?.getTime()).toBe(at(22, 16));
    expect(parsed.unsure).toEqual([]);
    expect(composeTaskInput(parsed, NOW)).toMatchObject({ title: "reunião", date: at(22, 16) });
    expect(fromWire({ ...wire, date: null }).date).toBeNull();
  });
});

describe("withEdits", () => {
  const parse = (text: string) => parseTaskText(text, NOW);

  it("o dia editado troca o lido e mantém a hora", () => {
    const r = withEdits(parse("reunião qui 16h"), { day: new Date(2026, 9, 30) }, NOW);
    expect(r.date?.getTime()).toBe(at(30, 16));
    expect(r.text).toBe("reunião");
  });

  it("a hora editada troca a lida; sem dia e já passada, cai amanhã", () => {
    const r = withEdits(parse("reunião 16h"), { time: { hour: 8, minute: 30 } }, NOW);
    expect(r.date?.getTime()).toBe(new Date(2026, 9, 22, 8, 30).getTime());
    expect(r.hasTime).toBe(true);
  });

  it("tirar: sem dia a hora fica, sem hora o dia fica, e o resto zera", () => {
    const parsed = parse("academia toda qui 7h por 1h");
    expect(withEdits(parsed, { time: null }, NOW)).toMatchObject({ hasTime: false, hasDay: true });
    expect(withEdits(parse("reunião qui 16h"), { day: null }, NOW).date?.getTime()).toBe(
      at(21, 16),
    );
    expect(withEdits(parsed, { duration: null, repeat: null }, NOW)).toMatchObject({
      duration: null,
      repeat: "Off",
    });
  });
});
