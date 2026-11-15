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

  test("descarta dia da semana que não é nome válido", () => {
    expect(normalizeRepeat({ Weekly: ["Segunda", "Friday", 3] })).toEqual({ Weekly: ["Friday"] });
    expect(normalizeRepeat({ Weekly: ["Segunda"] })).toBe("Off");
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

describe("repeatEvery", () => {
  const ny = "America/New_York";
  // Dia e hora local de cada instância, no fuso da série.
  const local = (out: Task[]) =>
    out.map((t) => {
      const p = zonedParts(t.date, ny);
      return `${p.month + 1}/${p.day} ${p.hour}h`;
    });
  // 09:00 em Nova York (EST, UTC-5).
  const at9 = (m: number, d: number) => Date.UTC(2026, m, d, 14);

  it("diária a cada 2 atravessa a virada do mês sem perder a fase", () => {
    const t = makeTask({ repeat: "Daily", repeatEvery: 2, date: at9(0, 28) });
    expect(local(expandRecurringTask(t, new Date(2026, 0, 1), ny))).toEqual(["1/30 9h"]);
    expect(local(expandRecurringTask(t, new Date(2026, 1, 1), ny)).slice(0, 3)).toEqual([
      "2/1 9h",
      "2/3 9h",
      "2/5 9h",
    ]);
  });

  it("mantém a hora de parede no DST (8/3 em Nova York)", () => {
    const t = makeTask({ repeat: "Daily", repeatEvery: 3, date: at9(2, 2) });
    expect(local(expandRecurringTask(t, new Date(2026, 2, 1), ny)).slice(0, 3)).toEqual([
      "3/5 9h",
      "3/8 9h",
      "3/11 9h",
    ]);
  });

  it("a cada 2 semanas na seg e qua, em blocos de 7 dias a partir da data", () => {
    // seg 05/01/2026: semanas de 05/01, 19/01, 02/02…
    const t = makeTask({
      repeat: { Weekly: ["Monday", "Wednesday"] },
      repeatEvery: 2,
      date: at9(0, 5),
    });
    expect(local(expandRecurringTask(t, new Date(2026, 0, 1), ny))).toEqual([
      "1/7 9h",
      "1/19 9h",
      "1/21 9h",
    ]);
    expect(local(expandRecurringTask(t, new Date(2026, 1, 1), ny))).toEqual([
      "2/2 9h",
      "2/4 9h",
      "2/16 9h",
      "2/18 9h",
    ]);
  });

  it("a cada 3 meses no dia 31 corta pro último dia sem arrastar a âncora", () => {
    const t = makeTask({ repeat: "Monthly", repeatEvery: 3, date: at9(0, 31) });
    const months = [1, 2, 3, 6, 9].map((m) =>
      local(expandRecurringTask(t, new Date(2026, m, 1), ny)),
    );
    expect(months).toEqual([[], [], ["4/30 9h"], ["7/31 9h"], ["10/31 9h"]]);
  });

  it("anual a cada 2", () => {
    const t = makeTask({ repeat: "Yearly", repeatEvery: 2, date: at9(4, 10) });
    expect(expandRecurringTask(t, new Date(2027, 4, 1), ny)).toEqual([]);
    expect(local(expandRecurringTask(t, new Date(2028, 4, 1), ny))).toEqual(["5/10 10h"]); // EDT
  });

  it("ainda pula o exdates", () => {
    const t = makeTask({ repeat: "Daily", repeatEvery: 2, date: at9(0, 1), exdates: [at9(0, 5)] });
    expect(local(expandRecurringTask(t, new Date(2026, 0, 1), ny)).slice(0, 2)).toEqual([
      "1/3 9h",
      "1/7 9h",
    ]);
  });
});
