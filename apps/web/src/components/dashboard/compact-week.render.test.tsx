/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { addDays, startOfDay } from "date-fns";

const dailify = vi.hoisted(() => vi.fn());
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));

import { CompactWeek } from "./compact-week";

describe("CompactWeek", () => {
  it("mostra os 7 dias a partir de hoje, marca hoje e o ponto de quem tem tarefa", () => {
    const goToDay = vi.fn();
    const today = startOfDay(new Date());
    dailify.mockReturnValue({
      tasks: [{ id: "a", date: today.getTime() + 9 * 3600_000 }],
      targetDay: undefined,
      goToDay,
    });

    render(<CompactWeek />);
    const days = screen.getAllByRole("button");
    expect(days).toHaveLength(7);
    expect(days[0].getAttribute("aria-current")).toBe("date");
    expect(days[1].getAttribute("aria-current")).toBeNull();
    expect(days[0].querySelector(".bg-accent-primary")).not.toBeNull();
    expect(days[1].querySelector(".bg-accent-primary")).toBeNull();

    fireEvent.click(days[2]);
    expect(goToDay).toHaveBeenCalledWith(addDays(today, 2));
  });
});
