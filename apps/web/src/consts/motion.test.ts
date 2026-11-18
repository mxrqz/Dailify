import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { duration, ease, radius, spring } from "./motion";

const css = readFileSync(new URL("../global.css", import.meta.url), "utf8");
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1];

describe("consts/motion", () => {
  it.each(Object.entries(duration))("--motion-duration-%s bate com o CSS", (name, seconds) => {
    expect(token(`motion-duration-${name}`)).toBe(`${seconds * 1000}ms`);
  });

  it.each([
    ["out", "motion-ease-out"],
    ["standard", "motion-ease-standard"],
    ["exit", "motion-ease-exit"],
    ["outExpo", "ease-out-expo"],
    ["outQuint", "ease-out-quint"],
    ["outSoft", "ease-out-soft"],
  ] as const)("ease.%s bate com --%s", (key, name) => {
    expect(token(name)).toBe(`cubic-bezier(${ease[key].join(", ")})`);
  });

  it("radius.panel matches --radius-panel at 16px per rem", () => {
    expect(token("radius-panel")).toBe(`${radius.panel / 16}rem`);
  });

  it("spring.soft é a aprovada no composer", () => {
    expect(spring.soft).toEqual({ type: "spring", visualDuration: 0.24, bounce: 0 });
  });
});
