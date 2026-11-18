import { afterEach, describe, expect, it, vi } from "vitest";

import { copy } from "@/components/dashboard/copy";
import { clockAt, dayLabel, weekdayDate, weekdayInitials, weekOf } from "./date-label";
import { setAppTimeZone, zonedAt } from "./zone";

afterEach(() => {
  setAppTimeZone(null);
  vi.useRealTimers();
});

describe("date labels", () => {
  it("reads the clock of an instant in the app zone", () => {
    setAppTimeZone("America/Sao_Paulo");
    const at = +zonedAt(2026, 10, 17, 16, 45);
    expect(clockAt(at, false)).toBe("16:45");
    expect(clockAt(at, true)).toBe("04:45 PM");
    setAppTimeZone("UTC");
    expect(clockAt(at, false)).toBe("19:45");
  });

  it("capitalizes the weekday and drops -feira", () => {
    setAppTimeZone("UTC");
    expect(weekdayDate(zonedAt(2026, 10, 17), "EEEE, d MMM")).toBe("Terça, 17 nov");
  });

  it("names today, tomorrow, the weekday and later dates", () => {
    setAppTimeZone("UTC");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 10, 17, 12));
    const now = zonedAt(2026, 10, 17, 12);
    expect(dayLabel(zonedAt(2026, 10, 17), now, 1)).toBe(copy.day.agenda);
    expect(dayLabel(zonedAt(2026, 10, 18), now, 1)).toBe(copy.day.tomorrow);
    expect(dayLabel(zonedAt(2026, 10, 20), now, 1)).toBe("Sexta");
    expect(dayLabel(zonedAt(2026, 10, 24), now, 1)).toBe("Terça, 24 nov");
  });

  it("starts the initials and the week at the configured first day", () => {
    setAppTimeZone("UTC");
    expect(weekdayInitials(1)).toEqual(["S", "T", "Q", "Q", "S", "S", "D"]);
    const week = weekOf(zonedAt(2026, 10, 18), 1);
    expect(week).toHaveLength(7);
    expect(week[0].getDate()).toBe(16);
  });
});
