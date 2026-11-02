import { describe, expect, test } from "vitest";

import { minuteOptions } from "./date-time-picker";

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
