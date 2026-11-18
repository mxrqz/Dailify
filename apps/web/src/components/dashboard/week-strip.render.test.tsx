/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { addDays, startOfWeek } from "date-fns";
import type { Task } from "@dailify/shared";

import { dayAnchorId } from "@/components/dashboard/day-section";

const dailify = vi.hoisted(() => vi.fn());
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));

import { WeekStrip } from "./week-strip";

const sunday = startOfWeek(new Date());
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
    // O 1º já passou da linha de leitura e o 2º também; o 4º ainda está abaixo.
    const sections = [0, 2, 4].map((offset, i) => {
      const section = document.createElement("section");
      section.id = dayAnchorId(addDays(sunday, offset));
      section.dataset.day = "true";
      const top = [-300, 20, 400][i];
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
    expect(days[3].getAttribute("aria-label")).toMatch(/com tarefas$/);
    expect(days[1].getAttribute("aria-label")).not.toMatch(/com tarefas$/);

    fireEvent.click(days[5]);
    expect(goToDay).toHaveBeenCalledWith(addDays(sunday, 5));
    for (const section of sections) section.remove();
  });
});
