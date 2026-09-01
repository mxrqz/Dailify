import { describe, it, expect } from "vitest";
import { PLAN_PRICING, formatPrice, yearlySavings } from "./pricing";

// `toLocaleString` pode devolver um non-breaking space (ou narrow no-break space) entre "R$" e o
// número dependendo do build de ICU — \s do regex cobre os dois, então o teste não quebra por isso.
function normalizeSpaces(s: string): string {
  return s.replace(/\s/g, " ");
}

describe("formatPrice", () => {
  it("centavos com fração", () => {
    expect(normalizeSpaces(formatPrice(990))).toBe("R$ 9,90");
  });
  it("valor redondo", () => {
    expect(normalizeSpaces(formatPrice(10000))).toBe("R$ 100,00");
  });
  it("zero", () => {
    expect(normalizeSpaces(formatPrice(0))).toBe("R$ 0,00");
  });
});

describe("yearlySavings", () => {
  it("pro: 12 mensalidades menos o anual", () => {
    const { monthly, yearly } = PLAN_PRICING.pro;
    expect(yearlySavings(PLAN_PRICING.pro)).toBe(monthly * 12 - yearly);
  });
  it("pro+ai: 12 mensalidades menos o anual", () => {
    const { monthly, yearly } = PLAN_PRICING["pro+ai"];
    expect(yearlySavings(PLAN_PRICING["pro+ai"])).toBe(monthly * 12 - yearly);
  });
});
