import { describe, it, expect } from "vitest";
import { doneThisPeriod, isWeekStart, periodStart } from "./period";

const tz = "America/Sao_Paulo";
// São Paulo é UTC-3 o ano todo desde 2019.
const sp = (y: number, m: number, d: number, h = 0, min = 0) =>
  Date.UTC(y, m - 1, d, h + 3, min);
const weekly = { Weekly: ["Wednesday"] };

describe("periodStart", () => {
  it("Daily vira às 6h", () => {
    expect(periodStart("Daily", sp(2026, 10, 21, 5, 59), 1, tz)).toBe(
      sp(2026, 10, 20, 6),
    );
    expect(periodStart("Daily", sp(2026, 10, 21, 6), 1, tz)).toBe(
      sp(2026, 10, 21, 6),
    );
  });

  it("Weekly volta até o início da semana", () => {
    expect(periodStart(weekly, sp(2026, 10, 21, 10), 1, tz)).toBe(
      sp(2026, 10, 19, 6),
    );
    expect(periodStart(weekly, sp(2026, 10, 25, 5), 0, tz)).toBe(
      sp(2026, 10, 18, 6),
    );
    expect(periodStart(weekly, sp(2026, 10, 25, 6), 0, tz)).toBe(
      sp(2026, 10, 25, 6),
    );
  });

  it("Weekly atravessa a virada de mês", () => {
    expect(periodStart(weekly, sp(2026, 11, 1, 10), 1, tz)).toBe(
      sp(2026, 10, 26, 6),
    );
  });

  it("Monthly e Yearly", () => {
    expect(periodStart("Monthly", sp(2026, 11, 1, 5), 1, tz)).toBe(
      sp(2026, 10, 1, 6),
    );
    expect(periodStart("Yearly", sp(2026, 10, 21), 1, tz)).toBe(
      sp(2026, 1, 1, 6),
    );
  });
});

describe("doneThisPeriod", () => {
  const task = { repeat: weekly, completed: [sp(2026, 10, 19, 8)] };
  it("vale dentro do período e expira na virada", () => {
    expect(doneThisPeriod(task, sp(2026, 10, 23), 1, tz)).toBe(true);
    expect(doneThisPeriod(task, sp(2026, 10, 26, 6, 1), 1, tz)).toBe(false);
  });
  it("é false sem repetição", () => {
    expect(
      doneThisPeriod(
        { repeat: "Off", completed: [sp(2026, 10, 19)] },
        sp(2026, 10, 19),
        1,
        tz,
      ),
    ).toBe(false);
  });
});

describe("isWeekStart", () => {
  it("aceita só inteiros 0-6", () => {
    expect([0, 6].every(isWeekStart)).toBe(true);
    expect([7, -1, 1.5, "1"].some(isWeekStart)).toBe(false);
  });
});
