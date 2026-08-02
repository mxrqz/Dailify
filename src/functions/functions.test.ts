import { describe, test, expect } from "vitest";
import {
  getNextTask,
  isTaskModified,
  getCompletionDate,
  getTasksForDay,
  expandRecurringTask,
  upsertTaskById,
  normalizeRepeat,
  getTime,
  returnFractedDate,
  unixToDate,
} from "./functions";
import type { TaskProps } from "@/types/types";

function makeTask(over: Partial<TaskProps> = {}): TaskProps {
  return {
    id: "1",
    title: "t",
    description: "d",
    completed: [],
    duration: "30",
    priority: 0,
    repeat: "Off",
    date: new Date(2026, 7, 1, 10, 0),
    ...over,
  };
}

describe("getNextTask", () => {
  test("does not mutate the input array", () => {
    const a = makeTask({ id: "a", date: new Date(2026, 7, 10) });
    const b = makeTask({ id: "b", date: new Date(2026, 7, 5) });
    const input = [a, b];
    getNextTask(input);
    expect(input.map((t) => t.id)).toEqual(["a", "b"]);
  });

  test("returns the nearest future task, ignoring past ones", () => {
    const past = makeTask({ id: "past", date: new Date(Date.now() - 86_400_000) });
    const soon = makeTask({ id: "soon", date: new Date(Date.now() + 3_600_000) });
    const later = makeTask({ id: "later", date: new Date(Date.now() + 7_200_000) });
    expect(getNextTask([later, past, soon])?.id).toBe("soon");
  });

  test("returns undefined when every task is in the past", () => {
    expect(getNextTask([makeTask({ date: new Date(Date.now() - 86_400_000) })])).toBeUndefined();
  });

  test("returns undefined for an empty list", () => {
    expect(getNextTask([])).toBeUndefined();
  });
});

describe("isTaskModified", () => {
  test("returns false when nothing changed", () => {
    const t = makeTask();
    expect(isTaskModified(t, { ...t })).toBe(false);
  });

  test("detects a title change", () => {
    const t = makeTask();
    expect(isTaskModified(t, { ...t, title: "other" })).toBe(true);
  });

  test("detects a date change", () => {
    const t = makeTask();
    expect(isTaskModified(t, { ...t, date: new Date(2026, 7, 2, 10, 0) })).toBe(true);
  });

  test("does not crash when updated.alert is undefined", () => {
    const t = makeTask({ alert: new Date(2026, 7, 1, 9, 0) });
    expect(() => isTaskModified(t, { ...t, alert: undefined })).not.toThrow();
  });
});

describe("getCompletionDate", () => {
  test("true when completed on the same calendar day", () => {
    const day = new Date(2026, 7, 1, 8, 0);
    const t = makeTask({ completed: [new Date(2026, 7, 1, 22, 0)] });
    expect(getCompletionDate(t, day)).toBe(true);
  });

  test("false when completed on a different day", () => {
    const day = new Date(2026, 7, 1);
    const t = makeTask({ completed: [new Date(2026, 7, 2)] });
    expect(getCompletionDate(t, day)).toBe(false);
  });

  test("false for an empty completed array", () => {
    expect(getCompletionDate(makeTask({ completed: [] }), new Date(2026, 7, 1))).toBe(false);
  });
});

describe("getTasksForDay", () => {
  test("includes tasks on the same calendar day", () => {
    const day = new Date(2026, 7, 1);
    const t = makeTask({ id: "same", date: new Date(2026, 7, 1, 15, 0) });
    expect(getTasksForDay([t], day).map((x) => x.id)).toEqual(["same"]);
  });

  test("excludes the same day-of-month in a different month or year", () => {
    const day = new Date(2026, 7, 1);
    const otherMonth = makeTask({ id: "m", date: new Date(2026, 6, 1) });
    const otherYear = makeTask({ id: "y", date: new Date(2025, 7, 1) });
    expect(getTasksForDay([otherMonth, otherYear], day)).toEqual([]);
  });
});

describe("small date helpers", () => {
  test("returnFractedDate splits a date", () => {
    expect(returnFractedDate(new Date(2026, 7, 1))).toEqual({ day: 1, month: 8, year: 2026 });
  });

  test("getTime formats HH:MM zero-padded", () => {
    expect(getTime(new Date(2026, 7, 1, 9, 5), "HH:MM")).toBe("09:05");
  });

  test("unixToDate converts seconds to a Date", () => {
    expect(unixToDate(0).getTime()).toBe(0);
  });
});

function dateOf(t: TaskProps): Date {
  if (!(t.date instanceof Date)) throw new Error("expected a JS Date instance");
  return t.date;
}

describe("expandRecurringTask", () => {
  test("Daily: creation month starts the day after the original (base doc covers the original day)", () => {
    const t = makeTask({ repeat: "Daily", date: new Date(2026, 7, 10, 9, 5) });
    const out = expandRecurringTask(t, new Date(2026, 7, 1));
    const days = out.map(dateOf).map((d) => d.getDate());
    expect(out).toHaveLength(21);
    expect(days[0]).toBe(11);
    expect(days[days.length - 1]).toBe(31);
    expect(days.every((d) => d > 10)).toBe(true);
  });

  test("Daily: a later month yields every day of that month", () => {
    const t = makeTask({ repeat: "Daily", date: new Date(2026, 7, 10) });
    const out = expandRecurringTask(t, new Date(2026, 8, 1)); // September, 30 days
    expect(out).toHaveLength(30);
    expect(dateOf(out[0]).getMonth()).toBe(8);
  });

  test("Daily: months before creation are empty", () => {
    const t = makeTask({ repeat: "Daily", date: new Date(2026, 7, 10) });
    expect(expandRecurringTask(t, new Date(2026, 6, 1))).toEqual([]);
  });

  test("Weekly: matches the requested weekdays in a non-creation month", () => {
    const t = makeTask({ repeat: { Weekly: ["Monday"] }, date: new Date(2026, 6, 1) });
    const out = expandRecurringTask(t, new Date(2026, 7, 1)); // August 2026
    const expected: number[] = [];
    for (let d = 1; d <= 31; d++) if (new Date(2026, 7, d).getDay() === 1) expected.push(d);
    expect(out.map(dateOf).map((d) => d.getDate())).toEqual(expected);
    expect(out.map(dateOf).every((d) => d.getDay() === 1)).toBe(true);
  });

  test("Monthly: skips the creation month and clamps an overflowing day", () => {
    const t = makeTask({ repeat: "Monthly", date: new Date(2026, 7, 31) });
    expect(expandRecurringTask(t, new Date(2026, 7, 1))).toEqual([]);
    const sep = expandRecurringTask(t, new Date(2026, 8, 1)); // Sep has 30 days
    expect(sep).toHaveLength(1);
    expect(dateOf(sep[0]).getMonth()).toBe(8);
    expect(dateOf(sep[0]).getDate()).toBe(30);
  });

  test("Yearly: only the same month in a later year", () => {
    const t = makeTask({ repeat: "Yearly", date: new Date(2026, 7, 15) });
    expect(expandRecurringTask(t, new Date(2026, 7, 1))).toEqual([]); // creation year
    expect(expandRecurringTask(t, new Date(2027, 8, 1))).toEqual([]); // wrong month
    const aug27 = expandRecurringTask(t, new Date(2027, 7, 1));
    expect(aug27).toHaveLength(1);
    expect(dateOf(aug27[0]).getFullYear()).toBe(2027);
    expect(dateOf(aug27[0]).getDate()).toBe(15);
  });

  test("Off yields nothing", () => {
    expect(expandRecurringTask(makeTask({ repeat: "Off" }), new Date(2026, 7, 1))).toEqual([]);
  });

  test("upsertTaskById appends a new id and replaces an existing one", () => {
    const a = makeTask({ id: "a", title: "old" });
    const b = makeTask({ id: "b" });
    expect(upsertTaskById([a], b).map((t) => t.id)).toEqual(["a", "b"]);
    const out = upsertTaskById([a], makeTask({ id: "a", title: "new" }));
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("new");
  });

  test("normalizeRepeat keeps valid modes, preserves Weekly days, else Off", () => {
    expect(normalizeRepeat("Daily")).toBe("Daily");
    expect(normalizeRepeat({ Weekly: ["Monday", "Friday"] })).toEqual({
      Weekly: ["Monday", "Friday"],
    });
    expect(normalizeRepeat("Weekly")).toBe("Off");
    expect(normalizeRepeat(undefined)).toBe("Off");
    expect(normalizeRepeat({ Weekly: "nope" })).toBe("Off");
  });

  test("preserves task identity and returns JS Date instances", () => {
    const t = makeTask({ id: "abc", title: "Gym", repeat: "Daily", date: new Date(2026, 7, 10) });
    const out = expandRecurringTask(t, new Date(2026, 8, 1));
    expect(out[0].id).toBe("abc");
    expect(out[0].title).toBe("Gym");
    expect(out[0].date).toBeInstanceOf(Date);
  });
});
