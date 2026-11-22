/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { addMonths, startOfMonth } from "date-fns";
import type { Task } from "@dailify/shared";

import { copy } from "./copy";

const dailify = vi.hoisted(() => vi.fn());
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));

import { MonthCalendar, MonthPicker } from "./month-calendar";
import { closePanel } from "@/hooks/usePanel";

const day = new Date(2026, 10, 17);
const task: Task = {
  id: "t",
  title: "Aluguel",
  date: new Date(2026, 10, 20, 9).getTime(),
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
};

describe("<MonthPicker> and <MonthCalendar>", () => {
  it("expands to the picked day's month, dots days with tasks, pages and picks", () => {
    const loadMonth = vi.fn();
    const onPick = vi.fn();
    dailify.mockReturnValue({ tasks: [task], loadMonth, weekStart: 0 });
    render(<MonthPicker selected={day} onPick={onPick} />);

    const grid = within(screen.getByRole("group", { name: "novembro de 2026" }));
    expect(grid.getAllByRole("button")).toHaveLength(30);
    expect(grid.getByRole("button", { pressed: true })).toHaveTextContent("17");
    expect(grid.getByRole("button", { name: /^Sexta, 20 .*com tarefas$/ })).toBeInTheDocument();
    expect(loadMonth).toHaveBeenLastCalledWith(startOfMonth(day));

    fireEvent.click(screen.getByRole("button", { name: copy.aside.nextMonth }));
    expect(loadMonth).toHaveBeenLastCalledWith(startOfMonth(addMonths(day, 1)));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Dezembro 2026");

    fireEvent.click(screen.getByRole("button", { name: /^Quinta, 3 de dezembro/ }));
    expect(onPick).toHaveBeenCalledWith(new Date(2026, 11, 3));
  });

  it("lists up to three tasks per cell and opens the picked day in the panel", () => {
    const at = (h: number, id: string, completed: number[] = []): Task => ({
      ...task,
      id,
      title: `T${h}`,
      date: new Date(2026, 10, 20, h).getTime(),
      completed,
    });
    dailify.mockReturnValue({
      tasks: [
        at(14, "c"),
        at(8, "a", [new Date(2026, 10, 20, 9).getTime()]),
        at(10, "b"),
        at(16, "d"),
      ],
      selectedDay: day,
      goToDay: vi.fn(),
      loadMonth: vi.fn(),
      weekStart: 1,
      hour12: false,
    });
    render(<MonthCalendar />);

    const grid = within(screen.getByRole("group", { name: "novembro de 2026" }));
    const cell = grid.getByRole("button", { name: /^Sexta, 20 .*com tarefas$/ });
    expect(cell).toHaveTextContent("2008:00 T810:00 T1014:00 T14+1 mais");
    expect(within(cell).getByText("T8", { exact: false })).toHaveClass("line-through");

    fireEvent.click(cell);
    expect(grid.getByRole("button", { pressed: true })).toBe(cell);
    closePanel();
  });
});
