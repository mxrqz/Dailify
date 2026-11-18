import { describe, expect, test } from "vitest";

import { DURATIONS, durationOptions, minuteOptions } from "./task-options";

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
