import { describe, it, test, expect } from "vitest";
import { expandRecurringTask, normalizeRepeat } from "./recurrence";
import { zonedParts } from "./timezone";
import type { Task } from "./types";

const base: Task = {
  id: "t1",
  title: "x",
  duration: "10m",
  priority: 0,
  completed: [],
  repeat: "Daily",
  date: new Date(2026, 0, 10, 9, 0, 0).getTime(), // Jan 10 2026 09:00 local
};

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: "1",
    title: "t",
    completed: [],
    duration: "30",
    priority: 0,
    repeat: "Off",
    date: new Date(2026, 7, 1, 10, 0).getTime(),
    ...over,
  };
}

describe("expandRecurringTask", () => {
  it("Daily fills the rest of the creation month, skipping the original day", () => {
    const out = expandRecurringTask(base, new Date(2026, 0, 1));
    const days = out.map((t) => new Date(t.date).getDate());
    expect(days).not.toContain(10); // original day covered by the stored row
    expect(days).toContain(11);
    expect(days[days.length - 1]).toBe(31);
  });

  it("emits nothing before the task existed", () => {
    expect(expandRecurringTask(base, new Date(2025, 11, 1))).toEqual([]);
  });

  it("Weekly matches weekday names", () => {
    const wk: Task = { ...base, repeat: { Weekly: ["Monday"] } };
    const out = expandRecurringTask(wk, new Date(2026, 0, 1));
    expect(out.every((t) => new Date(t.date).getDay() === 1)).toBe(true);
  });

  test("Daily: creation month starts the day after the original (base doc covers the original day)", () => {
    const t = makeTask({ repeat: "Daily", date: new Date(2026, 7, 10, 9, 5).getTime() });
    const out = expandRecurringTask(t, new Date(2026, 7, 1));
    const days = out.map((x) => new Date(x.date).getDate());
    expect(out).toHaveLength(21);
    expect(days[0]).toBe(11);
    expect(days[days.length - 1]).toBe(31);
    expect(days.every((d) => d > 10)).toBe(true);
  });

  test("Daily: a later month yields every day of that month", () => {
    const t = makeTask({ repeat: "Daily", date: new Date(2026, 7, 10).getTime() });
    const out = expandRecurringTask(t, new Date(2026, 8, 1)); // September, 30 days
    expect(out).toHaveLength(30);
    expect(new Date(out[0].date).getMonth()).toBe(8);
  });

  test("Daily: months before creation are empty", () => {
    const t = makeTask({ repeat: "Daily", date: new Date(2026, 7, 10).getTime() });
    expect(expandRecurringTask(t, new Date(2026, 6, 1))).toEqual([]);
  });

  test("Weekly: matches the requested weekdays in a non-creation month", () => {
    const t = makeTask({ repeat: { Weekly: ["Monday"] }, date: new Date(2026, 6, 1).getTime() });
    const out = expandRecurringTask(t, new Date(2026, 7, 1)); // August 2026
    const expected: number[] = [];
    for (let d = 1; d <= 31; d++) if (new Date(2026, 7, d).getDay() === 1) expected.push(d);
    expect(out.map((x) => new Date(x.date).getDate())).toEqual(expected);
    expect(out.every((x) => new Date(x.date).getDay() === 1)).toBe(true);
  });

  test("Monthly: skips the creation month and clamps an overflowing day", () => {
    const t = makeTask({ repeat: "Monthly", date: new Date(2026, 7, 31).getTime() });
    expect(expandRecurringTask(t, new Date(2026, 7, 1))).toEqual([]);
    const sep = expandRecurringTask(t, new Date(2026, 8, 1)); // Sep has 30 days
    expect(sep).toHaveLength(1);
    expect(new Date(sep[0].date).getMonth()).toBe(8);
    expect(new Date(sep[0].date).getDate()).toBe(30);
  });

  test("Yearly: only the same month in a later year", () => {
    const t = makeTask({ repeat: "Yearly", date: new Date(2026, 7, 15).getTime() });
    expect(expandRecurringTask(t, new Date(2026, 7, 1))).toEqual([]); // creation year
    expect(expandRecurringTask(t, new Date(2027, 8, 1))).toEqual([]); // wrong month
    const aug27 = expandRecurringTask(t, new Date(2027, 7, 1));
    expect(aug27).toHaveLength(1);
    expect(new Date(aug27[0].date).getFullYear()).toBe(2027);
    expect(new Date(aug27[0].date).getDate()).toBe(15);
  });

  test("Off yields nothing", () => {
    expect(expandRecurringTask(makeTask({ repeat: "Off" }), new Date(2026, 7, 1))).toEqual([]);
  });

  test("preserves task identity and returns numeric epoch-ms dates", () => {
    const t = makeTask({
      id: "abc",
      title: "Gym",
      repeat: "Daily",
      date: new Date(2026, 7, 10).getTime(),
    });
    const out = expandRecurringTask(t, new Date(2026, 8, 1));
    expect(out[0].id).toBe("abc");
    expect(out[0].title).toBe("Gym");
    expect(typeof out[0].date).toBe("number");
  });
});

describe("exdates", () => {
  it("pula a ocorrência destacada e mantém as vizinhas", () => {
    const skipped = new Date(2026, 0, 12, 9, 0, 0).getTime();
    const out = expandRecurringTask({ ...base, exdates: [skipped] }, new Date(2026, 0, 1));

    expect(out.some((t) => t.date === skipped)).toBe(false);
    expect(out.some((t) => t.date === new Date(2026, 0, 13, 9, 0, 0).getTime())).toBe(true);
  });

  it("sem exdates nada muda", () => {
    const withEmpty = expandRecurringTask({ ...base, exdates: [] }, new Date(2026, 0, 1));
    expect(withEmpty).toHaveLength(expandRecurringTask(base, new Date(2026, 0, 1)).length);
  });
});

describe("normalizeRepeat", () => {
  it("passes valid keywords through", () => {
    expect(normalizeRepeat("Daily")).toBe("Daily");
  });
  it("coerces junk to Off", () => {
    expect(normalizeRepeat(42)).toBe("Off");
  });
  it("accepts a Weekly object", () => {
    expect(normalizeRepeat({ Weekly: ["Monday"] })).toEqual({ Weekly: ["Monday"] });
  });

  test("keeps valid modes, preserves Weekly days, else Off", () => {
    expect(normalizeRepeat("Daily")).toBe("Daily");
    expect(normalizeRepeat({ Weekly: ["Monday", "Friday"] })).toEqual({
      Weekly: ["Monday", "Friday"],
    });
    expect(normalizeRepeat("Weekly")).toBe("Off");
    expect(normalizeRepeat(undefined)).toBe("Off");
    expect(normalizeRepeat({ Weekly: "nope" })).toBe("Off");
  });
});

describe("expansão com fuso explícito", () => {
  // O bug do Worker: sem fuso, o servidor (UTC) reconstruía a hora-de-parede em UTC e a instância
  // saía 3h deslocada para o usuário em São Paulo.
  const daily: Task = {
    ...base,
    repeat: "Daily",
    date: Date.UTC(2026, 0, 10, 12, 0, 0), // 09:00 em São Paulo
  };

  it("mantém a hora local do usuário, não a do runtime", () => {
    const out = expandRecurringTask(daily, new Date(2026, 0, 1), "America/Sao_Paulo");
    const first = out[0];
    expect(new Date(first.date).toISOString()).toContain("T12:00:00");
  });

  it("não deixa a virada do mês escorregar para o fuso errado", () => {
    // 31/01 23:30 em São Paulo = 01/02 01:30 UTC: a instância pertence a JANEIRO para o usuário.
    const late: Task = { ...base, repeat: "Daily", date: Date.UTC(2026, 0, 5, 2, 30) };
    const january = expandRecurringTask(late, new Date(2026, 0, 1), "America/Sao_Paulo");
    const last = january[january.length - 1];
    expect(zonedParts(last.date, "America/Sao_Paulo")).toMatchObject({ month: 0, day: 31 });
  });

  it("Weekly usa o dia da semana do usuário", () => {
    // Domingo 22:00 em São Paulo já é segunda-feira em UTC.
    const sundayNight: Task = {
      ...base,
      repeat: { Weekly: ["Sunday"] },
      date: Date.UTC(2026, 0, 5, 1, 0), // dom 04/01 22:00 em SP
    };
    const out = expandRecurringTask(sundayNight, new Date(2026, 0, 1), "America/Sao_Paulo");
    for (const instance of out) {
      expect(zonedParts(instance.date, "America/Sao_Paulo").hour).toBe(22);
      const p = zonedParts(instance.date, "America/Sao_Paulo");
      expect(new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay()).toBe(0); // domingo
    }
    expect(out.length).toBeGreaterThan(0);
  });
});
