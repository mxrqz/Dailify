/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { addMonths, startOfMonth } from "date-fns";
import type { Task } from "@dailify/shared";

import { copy } from "./copy";

const dailify = vi.hoisted(() => vi.fn());
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@/hooks/useExternalEvents", () => ({ useExternalEvents: () => [] }));
vi.mock("@/components/dashboard/day-section", async (original) => ({
  ...(await original<typeof import("./day-section")>()),
  DaySection: ({ day }: { day: Date }) => <section data-testid="day">{day.getDate()}</section>,
}));

import { MonthCalendar } from "./month-calendar";

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

describe("<MonthCalendar>", () => {
  it("o mês do dia escolhido, ponto onde há tarefa, setas carregam o mês, dia escolhe", () => {
    const goToDay = vi.fn();
    const loadMonth = vi.fn();
    const onCreateOn = vi.fn();
    dailify.mockReturnValue({
      tasks: [task],
      selectedDay: day,
      goToDay,
      loadMonth,
      loadedMonths: [],
      weekStart: 0,
    });
    render(<MonthCalendar onClose={() => {}} onCreateOn={onCreateOn} />);

    const grid = within(screen.getByRole("group", { name: "novembro de 2026" }));
    expect(grid.getAllByRole("button")).toHaveLength(30);
    expect(grid.getByRole("button", { pressed: true })).toHaveTextContent("17");
    expect(grid.getByRole("button", { name: /^Sexta, 20 .*com tarefas$/ })).toBeInTheDocument();
    expect(loadMonth).toHaveBeenLastCalledWith(startOfMonth(day));

    fireEvent.click(screen.getByRole("button", { name: copy.aside.nextMonth }));
    expect(loadMonth).toHaveBeenLastCalledWith(startOfMonth(addMonths(day, 1)));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dezembro 2026");

    fireEvent.click(screen.getByRole("button", { name: /^Quinta, 3 de dezembro/ }));
    expect(goToDay).toHaveBeenCalledWith(new Date(2026, 11, 3));

    fireEvent.click(screen.getByRole("button", { name: /^Criar tarefa em/ }));
    expect(onCreateOn).toHaveBeenCalledWith(day);
  });
});
