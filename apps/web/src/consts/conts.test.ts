import { describe, test, expect } from "vitest";
import { PLAN_ID, planMap } from "./conts";
import { priorityText, priorityTextColor } from "./conts";

describe("plan ids", () => {
  test("every PLAN_ID value is a key in planMap", () => {
    for (const id of Object.values(PLAN_ID)) {
      expect(Object.keys(planMap)).toContain(id);
    }
  });
});

describe("priority scale", () => {
  const scales = { priorityText, priorityTextColor };

  test("every scale has exactly 5 levels (0-4)", () => {
    for (const [name, scale] of Object.entries(scales)) {
      expect(scale, name).toHaveLength(5);
    }
  });

  test("color scales point at priority tokens, never raw Tailwind colors", () => {
    priorityTextColor.forEach((cls, i) => {
      // An out-of-order table paints "Urgente" grey and breaks nothing else.
      expect(cls, `priorityTextColor[${i}]`).toMatch(new RegExp(`priority-${i}\\b`));
      expect(cls, `priorityTextColor[${i}]`).not.toMatch(/-(red|green|yellow|orange|gray|zinc)-\d/);
    });
  });

  test("no scale uses /opacity", () => {
    for (const [name, scale] of Object.entries(scales)) {
      for (const cls of scale) expect(cls, name).not.toContain("/");
    }
  });
});
