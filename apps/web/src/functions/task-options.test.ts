import { describe, expect, test } from "vitest";

import {
  DURATIONS,
  REMINDER_OFFSETS,
  durationOptions,
  minuteOptions,
  reminderBefore,
  reminderOptions,
} from "./task-options";

describe("minuteOptions", () => {
  test("de 5 em 5 quando o minuto já é um deles", () => {
    expect(minuteOptions(30)).toHaveLength(12);
  });

  test("mantém um minuto fora do passo, na ordem", () => {
    const options = minuteOptions(37);
    expect(options).toContain(37);
    expect(options.indexOf(37)).toBe(options.indexOf(35) + 1);
  });
});

describe("durationOptions", () => {
  test("puts an off-scale duration first and keeps the scale otherwise", () => {
    expect(durationOptions("30m")).toBe(DURATIONS);
    expect(durationOptions("3h")).toEqual(["3h", ...DURATIONS]);
  });
});

describe("reminderOptions", () => {
  test("puts an off-list offset first and keeps the list otherwise", () => {
    expect(reminderOptions(30)).toEqual([...REMINDER_OFFSETS]);
    expect(reminderOptions(undefined)).toEqual([...REMINDER_OFFSETS]);
    expect(reminderOptions(45)).toEqual([45, ...REMINDER_OFFSETS]);
  });
});

describe("reminderBefore", () => {
  const date = Date.UTC(2026, 9, 22, 15);

  test("reads the minutes between the alert and the task", () => {
    expect(reminderBefore({ date, alert: date - 30 * 60_000 })).toBe(30);
    expect(reminderBefore({ date })).toBeUndefined();
  });

  test("measures an instance from its series anchor", () => {
    const anchor = date - 7 * 86_400_000;
    expect(reminderBefore({ date, seriesStart: anchor, alert: anchor - 10 * 60_000 })).toBe(10);
  });
});
