import { describe, test, expect } from "vitest";
import {
  getNextTask,
  isTaskModified,
  getCompletionDate,
  getTasksForDay,
  upsertTaskById,
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
    date: new Date(2026, 7, 1, 10, 0).getTime(),
    ...over,
  };
}

describe("getNextTask", () => {
  test("does not mutate the input array", () => {
    const a = makeTask({ id: "a", date: new Date(2026, 7, 10).getTime() });
    const b = makeTask({ id: "b", date: new Date(2026, 7, 5).getTime() });
    const input = [a, b];
    getNextTask(input);
    expect(input.map((t) => t.id)).toEqual(["a", "b"]);
  });

  test("returns the nearest future task, ignoring past ones", () => {
    const past = makeTask({ id: "past", date: Date.now() - 86_400_000 });
    const soon = makeTask({ id: "soon", date: Date.now() + 3_600_000 });
    const later = makeTask({ id: "later", date: Date.now() + 7_200_000 });
    expect(getNextTask([later, past, soon])?.id).toBe("soon");
  });

  test("returns undefined when every task is in the past", () => {
    expect(getNextTask([makeTask({ date: Date.now() - 86_400_000 })])).toBeUndefined();
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
    expect(isTaskModified(t, { ...t, date: new Date(2026, 7, 2, 10, 0).getTime() })).toBe(true);
  });

  test("does not crash when updated.alert is undefined", () => {
    const t = makeTask({ alert: new Date(2026, 7, 1, 9, 0).getTime() });
    expect(() => isTaskModified(t, { ...t, alert: undefined })).not.toThrow();
  });
});

describe("getCompletionDate", () => {
  test("true when completed on the same calendar day", () => {
    const day = new Date(2026, 7, 1, 8, 0);
    const t = makeTask({ completed: [new Date(2026, 7, 1, 22, 0).getTime()] });
    expect(getCompletionDate(t, day)).toBe(true);
  });

  test("false when completed on a different day", () => {
    const day = new Date(2026, 7, 1);
    const t = makeTask({ completed: [new Date(2026, 7, 2).getTime()] });
    expect(getCompletionDate(t, day)).toBe(false);
  });

  test("false for an empty completed array", () => {
    expect(getCompletionDate(makeTask({ completed: [] }), new Date(2026, 7, 1))).toBe(false);
  });
});

describe("getTasksForDay", () => {
  test("includes tasks on the same calendar day", () => {
    const day = new Date(2026, 7, 1);
    const t = makeTask({ id: "same", date: new Date(2026, 7, 1, 15, 0).getTime() });
    expect(getTasksForDay([t], day).map((x) => x.id)).toEqual(["same"]);
  });

  test("excludes the same day-of-month in a different month or year", () => {
    const day = new Date(2026, 7, 1);
    const otherMonth = makeTask({ id: "m", date: new Date(2026, 6, 1).getTime() });
    const otherYear = makeTask({ id: "y", date: new Date(2025, 7, 1).getTime() });
    expect(getTasksForDay([otherMonth, otherYear], day)).toEqual([]);
  });
});

describe("small date helpers", () => {
  test("returnFractedDate splits a date", () => {
    expect(returnFractedDate(new Date(2026, 7, 1))).toEqual({ day: 1, month: 8, year: 2026 });
  });

  test("getTime formats HH:MM zero-padded", () => {
    expect(getTime(new Date(2026, 7, 1, 9, 5).getTime(), "HH:MM")).toBe("09:05");
  });

  test("unixToDate converts seconds to a Date", () => {
    expect(unixToDate(0).getTime()).toBe(0);
  });
});

describe("upsertTaskById", () => {
  test("appends a new id and replaces an existing one", () => {
    const a = makeTask({ id: "a", title: "old" });
    const b = makeTask({ id: "b" });
    expect(upsertTaskById([a], b).map((t) => t.id)).toEqual(["a", "b"]);
    const out = upsertTaskById([a], makeTask({ id: "a", title: "new" }));
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("new");
  });
});
