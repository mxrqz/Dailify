/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Task } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";

const dailify = vi.hoisted(() => vi.fn());
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@/components/dashboard/anytime-block", () => ({
  AnytimeBlock: () => null,
  ScheduleDrop: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/dashboard/day-task-row", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/dashboard/day-task-row")>()),
  DayTaskRow: ({ task }: { task: Task }) => <span>{task.title}</span>,
}));

import { DaySection } from "./day-section";

// Wednesday 18 Nov 2026, 10:00. With a Monday start, its week runs 16 to 22.
const WEDNESDAY = new Date(2026, 10, 18, 10, 0);
const SUNDAY = new Date(2026, 10, 22, 10, 0);

const task = (title: string, date: Date): Task => ({
  id: title,
  title,
  date: date.getTime(),
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
});

function renderAt(now: Date, day: Date, tasks: Task[] = []) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  dailify.mockReturnValue({ tasks, hour12: false, weekStart: 1 });
  render(<DaySection day={day} />);
  return screen.getByRole("heading", { level: 2 }).textContent;
}

afterEach(() => vi.useRealTimers());

describe("<DaySection> day label with a Monday week start", () => {
  it("labels today as the agenda", () => {
    expect(renderAt(WEDNESDAY, new Date(2026, 10, 18))).toBe(copy.day.agenda);
  });

  it("labels tomorrow by name", () => {
    expect(renderAt(WEDNESDAY, new Date(2026, 10, 19))).toBe(copy.day.tomorrow);
  });

  it("shows only the weekday for the coming Sunday, still this week", () => {
    expect(renderAt(WEDNESDAY, new Date(2026, 10, 22))).toBe("Domingo");
  });

  it("adds the date on a Sunday for next week's Tuesday", () => {
    expect(renderAt(SUNDAY, new Date(2026, 10, 24))).toBe("Terça, 24 nov");
  });
});

describe("<DaySection> now line", () => {
  it("sits below what already started and above what starts this minute", () => {
    renderAt(WEDNESDAY, new Date(2026, 10, 18), [
      task("At nine", new Date(2026, 10, 18, 9, 0)),
      task("At ten", new Date(2026, 10, 18, 10, 0)),
    ]);
    const order = screen
      .getAllByRole("listitem")
      .map((li) => (li.querySelector("[role=separator]") ? "now" : li.textContent));
    expect(order).toEqual(["At nine", "now", "At ten"]);
  });
});

describe("<DaySection> multi-day tasks", () => {
  it("opens the next day with a task that started the day before", () => {
    const trip = { ...task("Trip", new Date(2026, 10, 18)), duration: "48h" };
    renderAt(WEDNESDAY, new Date(2026, 10, 19), [
      task("At eight", new Date(2026, 10, 19, 8, 0)),
      trip,
    ]);
    const order = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(order).toEqual(["Trip", "At eight"]);
  });
});

describe("<DaySection> done tasks", () => {
  const done = (t: Task) => ({ ...t, completed: [t.date] });

  it("settles a done task after the open ones and the now line", () => {
    renderAt(WEDNESDAY, new Date(2026, 10, 18), [
      done(task("At eight", new Date(2026, 10, 18, 8, 0))),
      task("At nine", new Date(2026, 10, 18, 9, 0)),
    ]);
    const order = screen
      .getAllByRole("listitem")
      .map((li) => (li.querySelector("[role=separator]") ? "now" : li.textContent));
    expect(order).toEqual(["At nine", "now", "At eight"]);
    expect(screen.queryByText(copy.day.zeroed)).toBeNull();
  });

  it("says the day is zeroed once every task is done", () => {
    renderAt(WEDNESDAY, new Date(2026, 10, 19), [
      done(task("At eight", new Date(2026, 10, 19, 8, 0))),
    ]);
    expect(screen.getByText(copy.day.zeroed)).toBeInTheDocument();
  });
});
