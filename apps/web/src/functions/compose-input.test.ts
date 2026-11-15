import { describe, expect, it } from "vitest";

import { fromWire, markSegments, onDay, withEdits } from "./compose-input";
import { composeTaskInput, parseTaskText, type ParsedTask } from "@dailify/shared";
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

describe("markSegments", () => {
  const parse = (text: string) => parseTaskText(text, NOW);
  const marked = (text: string) =>
    markSegments(text, parse(text), []).filter((s) => s.field || s.unsure);
  const doubt = (start: number, end: number): Pick<ParsedTask, "fields" | "unsure"> => ({
    fields: { day: [], time: [], duration: [], repeat: [], links: [] },
    unsure: [{ code: "ambiguous-number", span: [start, end] }],
  });

  it("corta o input nos campos lidos, e a dúvida vai até o fim da palavra", () => {
    expect(markSegments("pagar luz amanhã às 15h", parse("pagar luz amanhã às 15h"), [])).toEqual([
      { text: "pagar luz ", field: false, unsure: false },
      { text: "amanhã", field: true, unsure: false },
      { text: " ", field: false, unsure: false },
      { text: "às 15h", field: true, unsure: false },
    ]);
    expect(marked("o que tenho amanhã?")).toEqual([
      { text: "o que tenho", field: false, unsure: true },
      { text: "amanhã", field: true, unsure: false },
    ]);
    expect(marked("ligar 1430")).toEqual([{ text: "1430", field: false, unsure: true }]);
  });

  it("trecho ignorado e entre aspas não marcam, nem com dúvida em cima", () => {
    expect(markSegments("ligar 1430", doubt(6, 10), [[6, 10]])).toEqual([
      { text: "ligar 1430", field: false, unsure: false },
    ]);
    expect(markSegments('ligar "14"', doubt(7, 9), [])).toEqual([
      { text: 'ligar "14"', field: false, unsure: false },
    ]);
  });
});
