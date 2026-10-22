import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { duration, ease, slideX, spring } from "./motion";

const css = readFileSync(new URL("../global.css", import.meta.url), "utf8");
const token = (name: string) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1];

describe("consts/motion", () => {
  it.each(Object.entries(duration))("--duration-%s bate com o CSS", (name, seconds) => {
    expect(token(`motion-duration-${name}`)).toBe(`${seconds * 1000}ms`);
  });

  it.each([
    ["out", "motion-ease-out"],
    ["standard", "motion-ease-standard"],
    ["exit", "motion-ease-exit"],
    ["outExpo", "ease-out-expo"],
  ] as const)("ease.%s bate com --%s", (key, name) => {
    expect(token(name)).toBe(`cubic-bezier(${ease[key].join(", ")})`);
  });

  it("spring.soft é a aprovada no composer", () => {
    expect(spring.soft).toEqual({ type: "spring", visualDuration: 0.24, bounce: 0 });
  });

  it("slideX entra de um lado e sai pelo oposto", () => {
    expect(slideX(1).enter.x).toBe(24);
    expect(slideX(-1).exit.x).toBe(24);
  });
});
