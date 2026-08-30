import { describe, it, expect } from "vitest";
import { parseNewTask, parseTaskFields } from "../src/lib/task-input";

const valid = {
  title: "Comprar leite",
  date: new Date(2026, 2, 10, 9).getTime(),
  duration: "10m",
  priority: 2,
  repeat: "Off",
};

const errorOf = (r: { error: string } | object): string | undefined =>
  "error" in r ? r.error : undefined;

describe("parseNewTask", () => {
  it("aceita um body válido e devolve completed vazio", () => {
    const r = parseNewTask(valid);
    expect(errorOf(r)).toBeUndefined();
    if ("task" in r) {
      expect(r.task).toMatchObject({ title: "Comprar leite", priority: 2, duration: "10m" });
      expect(r.task.completed).toEqual([]);
    }
  });

  it("preenche os defaults dos campos ausentes", () => {
    const r = parseNewTask({ title: "x", date: valid.date });
    if ("task" in r) expect(r.task).toMatchObject({ duration: "", priority: 0, repeat: "Off" });
  });

  // O buraco que motivou o validador: sem title, o INSERT batia no NOT NULL do D1 e virava 500.
  it("recusa title ausente, vazio ou não-string", () => {
    expect(errorOf(parseNewTask({ date: valid.date }))).toBe("title required");
    expect(errorOf(parseNewTask({ ...valid, title: "   " }))).toBe("invalid title");
    expect(errorOf(parseNewTask({ ...valid, title: 42 }))).toBe("invalid title");
  });

  it("recusa date ausente, string ou em segundos", () => {
    expect(errorOf(parseNewTask({ title: "x" }))).toBe("date required");
    expect(errorOf(parseNewTask({ ...valid, date: "2026-03-10" }))).toBe("invalid date");
    expect(errorOf(parseNewTask({ ...valid, date: 1772000000 }))).toBe("invalid date");
  });

  it("recusa priority fora da escala 0-4", () => {
    expect(errorOf(parseNewTask({ ...valid, priority: 7 }))).toBe("invalid priority");
    expect(errorOf(parseNewTask({ ...valid, priority: 1.5 }))).toBe("invalid priority");
  });

  it("recusa tags que não são lista de string", () => {
    expect(errorOf(parseNewTask({ ...valid, tags: "casa" }))).toBe("invalid tags");
    expect(errorOf(parseNewTask({ ...valid, tags: [{}] }))).toBe("invalid tags");
  });

  it("recusa link não-http", () => {
    expect(errorOf(parseNewTask({ ...valid, links: ["javascript:alert(1)"] }))).toBe(
      "invalid links",
    );
  });

  it("ignora id e completed vindos do cliente", () => {
    const r = parseNewTask({ ...valid, id: "hack", completed: [1, 2, 3] });
    if ("task" in r) {
      expect(r.task.completed).toEqual([]);
      expect(Reflect.get(r.task, "id")).toBeUndefined();
    }
  });

  it("recusa body que não é objeto", () => {
    expect(errorOf(parseNewTask(undefined))).toBe("invalid body");
    expect(errorOf(parseNewTask("{}"))).toBe("invalid body");
  });
});

describe("parseTaskFields (PATCH)", () => {
  it("aceita patch parcial", () => {
    const r = parseTaskFields({ title: "Novo" }, { partial: true });
    if ("fields" in r) expect(r.fields).toEqual({ title: "Novo" });
  });

  it("valida os campos que vieram", () => {
    expect(errorOf(parseTaskFields({ priority: -1 }, { partial: true }))).toBe("invalid priority");
    expect(errorOf(parseTaskFields({ tags: 3 }, { partial: true }))).toBe("invalid tags");
  });

  it("normaliza repeat desconhecido para Off", () => {
    const r = parseTaskFields({ repeat: "Hourly" }, { partial: true });
    if ("fields" in r) expect(r.fields.repeat).toBe("Off");
  });
});
