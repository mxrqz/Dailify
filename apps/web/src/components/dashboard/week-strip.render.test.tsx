/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { addDays, startOfWeek } from "date-fns";
import type { Task } from "@dailify/shared";

import { APP_BAR_ID } from "@/components/app-header";
import { copy } from "@/components/dashboard/copy";
import { dayAnchorId } from "@/components/dashboard/day-section";
import { weekdayDate } from "@/functions/date-label";
import { fill } from "@/functions/functions";

const dailify = vi.hoisted(() => vi.fn());
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));

import { WeekStrip } from "./week-strip";

// Wednesday noon: the week under test never straddles a real midnight.
const NOW = new Date(2026, 9, 21, 12).getTime();
const sunday = startOfWeek(NOW);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());
const task = (date: Date): Task => ({
  id: String(date.getTime()),
  title: "x",
  date: date.getTime() + 9 * 3600_000,
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
});

describe("WeekStrip", () => {
  it("a semana de hoje: pílula no dia que se está lendo, ponto só onde há tarefa, tocar vai ao dia", () => {
    const goToDay = vi.fn();
    dailify.mockReturnValue({ tasks: [task(addDays(sunday, 3))], goToDay, weekStart: 0 });
    // The reading line sits 16px under the strip (at 0 here): the 1st and 2nd passed it, the 4th not.
    const sections = [0, 2, 4].map((offset, i) => {
      const section = document.createElement("section");
      section.id = dayAnchorId(addDays(sunday, offset));
      section.dataset.day = "true";
      const top = [-300, 10, 400][i];
      const rect = { x: 0, y: top, width: 0, height: 0, top, right: 0, bottom: top, left: 0 };
      section.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect });
      document.body.append(section);
      return section;
    });

    render(<WeekStrip />);

    const days = screen.getAllByRole("button");
    expect(days).toHaveLength(7);
    expect(days[2]).toHaveAttribute("aria-pressed", "true");
    expect(days[0]).toHaveAttribute("aria-pressed", "false");
    const withTasks = (day: Date) =>
      fill(copy.day.withTasks, { day: weekdayDate(day, "EEEE, d 'de' MMMM") });
    expect(days[3]).toHaveAccessibleName(withTasks(addDays(sunday, 3)));
    expect(days[1]).toHaveAccessibleName(weekdayDate(addDays(sunday, 1), "EEEE, d 'de' MMMM"));

    fireEvent.click(days[5]);
    expect(goToDay).toHaveBeenCalledWith(addDays(sunday, 5));
    for (const section of sections) section.remove();
  });

  it("expanded, it shows the month; a pick collapses it and scrolls only once collapsed", () => {
    const goToDay = vi.fn();
    const onCollapse = vi.fn();
    dailify.mockReturnValue({
      tasks: [],
      goToDay,
      loadMonth: vi.fn(),
      selectedDay: new Date(NOW),
      weekStart: 0,
    });
    const view = render(<WeekStrip expanded onCollapse={onCollapse} />);

    fireEvent.click(screen.getByRole("button", { name: /^Sexta, 30 de outubro/ }));
    expect(onCollapse).toHaveBeenCalled();
    expect(goToDay).not.toHaveBeenCalled();

    view.rerender(<WeekStrip onCollapse={onCollapse} />);
    expect(goToDay).toHaveBeenCalledWith(new Date(2026, 9, 30));
    expect(screen.getAllByRole("button")).toHaveLength(7);
  });

  it("docks over the bar as it scrolls, fading the bar's actions, and lets go on unmount", async () => {
    dailify.mockReturnValue({
      tasks: [],
      goToDay: vi.fn(),
      weekStart: 0,
      selectedDay: new Date(NOW),
    });
    const header = document.createElement("header");
    header.id = APP_BAR_ID;
    header.append(document.createElement("button"));
    document.body.append(header);
    const view = render(<WeekStrip />);
    const root = document.documentElement.style;
    expect(root.getPropertyValue("--undock")).toBe("1");

    // Stuck at the top (24) of a bar ending at 76: fully docked.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 24, 50, 52),
    );
    act(() => void window.dispatchEvent(new Event("scroll")));
    await vi.waitFor(() => expect(root.getPropertyValue("--undock")).toBe("0"));

    view.unmount();
    expect(root.getPropertyValue("--undock")).toBe("");
    header.remove();
  });
});
