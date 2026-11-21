import { describe, expect, it } from "vitest";
import { TASK_LIMITS, zonedEpoch } from "@dailify/shared";

import { spanDayKeys, spanLength, spanOf } from "./span";

const SP = "America/Sao_Paulo";
const NY = "America/New_York";
const at = (zone: string, month: number, day: number, hour = 0) =>
  zonedEpoch({ year: 2026, month, day, hour, minute: 0, second: 0 }, zone);

describe("span", () => {
  it("counts an all-day trip from midnight as one day per calendar day", () => {
    const trip = { date: at(SP, 11, 1), duration: "72h" };
    expect(spanDayKeys(trip, SP)).toEqual(["2026-11-1", "2026-11-2", "2026-11-3"]);
    expect(spanOf(trip, at(SP, 11, 2, 15), SP)).toEqual({ k: 2, n: 3 });
    expect(spanOf(trip, at(SP, 11, 4, 1), SP)).toBeUndefined();
  });

  it("puts a timed task crossing midnight on both days", () => {
    const late = { date: at(SP, 4, 31, 22), duration: "4h" };
    expect(spanDayKeys(late, SP)).toEqual(["2026-4-31", "2026-5-1"]);
    expect(spanOf(late, at(SP, 4, 31, 23), SP)).toEqual({ k: 1, n: 2 });
  });

  it("keeps a task ending exactly at midnight on its own day", () => {
    const task = { date: at(SP, 4, 31, 23), duration: "1h" };
    expect(spanLength(task, SP)).toBe(1);
    expect(spanOf(task, task.date, SP)).toBeUndefined();
  });

  it("is DST-safe: a 71h span over the spring-forward night covers three days", () => {
    const task = { date: at(NY, 2, 7), duration: "71h" };
    expect(spanDayKeys(task, NY)).toEqual(["2026-2-7", "2026-2-8", "2026-2-9"]);
  });

  it("reads the days in the zone it is given", () => {
    // 22:00 to 02:00 in São Paulo is one Lisbon morning (02:00 to 06:00).
    const late = { date: at(SP, 4, 31, 22), duration: "4h" };
    expect(spanLength(late, "Europe/Lisbon")).toBe(1);
  });

  it("caps a long span", () => {
    const task = { date: at(SP, 0, 1), duration: "999h" };
    expect(spanLength(task, SP)).toBe(TASK_LIMITS.spanDaysMax);
  });
});
