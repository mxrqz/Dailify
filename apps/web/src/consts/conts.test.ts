import { describe, test, expect } from "vitest";
import { PLAN_ID, planMap } from "./conts";
import {
  priorityText,
  priorityTextColor,
  priorityBorderColor,
  priorityBgColor,
  prioritySelectedBgColor,
} from "./conts";

describe("plan ids", () => {
  test("every PLAN_ID value is a key in planMap", () => {
    for (const id of Object.values(PLAN_ID)) {
      expect(Object.keys(planMap)).toContain(id);
    }
  });
});

describe("priority scale", () => {
  const scales = {
    priorityText,
    priorityTextColor,
    priorityBorderColor,
    priorityBgColor,
    prioritySelectedBgColor,
  };

  test("every scale has exactly 5 levels (0-4)", () => {
    for (const [name, scale] of Object.entries(scales)) {
      expect(scale, name).toHaveLength(5);
    }
  });

  test("color scales point at priority tokens, never raw Tailwind colors", () => {
    const colorScales = {
      priorityTextColor,
      priorityBorderColor,
      priorityBgColor,
      prioritySelectedBgColor,
    };
    for (const [name, scale] of Object.entries(colorScales)) {
      scale.forEach((cls, i) => {
        // Aceita `…priority-0` (cor sólida) e `…priority-bg-0` (o fill suave do chip) — o que
        // importa é o índice do token bater com a posição no array, que é o erro que dói:
        // um array fora de ordem pinta "urgente" de cinza sem quebrar nada.
        expect(cls, `${name}[${i}]`).toMatch(new RegExp(`priority-(bg-)?${i}\\b`));
        expect(cls, `${name}[${i}]`).not.toMatch(/-(red|green|yellow|orange|gray|zinc)-\d/);
      });
    }
  });

  test("no scale uses /opacity", () => {
    for (const [name, scale] of Object.entries(scales)) {
      for (const cls of scale) expect(cls, name).not.toContain("/");
    }
  });
});
