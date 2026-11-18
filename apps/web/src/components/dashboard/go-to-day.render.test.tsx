/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { addDays, addMonths, startOfMonth } from "date-fns";

import { DayList } from "./day-list";
import { dayAnchorId } from "./day-section";

const dailify = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }));
vi.mock("@/components/dailifyContext", () => ({ useDailify: () => dailify.current }));

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

describe("ir até o dia", () => {
  it("dia alvo sem tarefa aparece com 'Nada neste dia' e é rolado", () => {
    const now = new Date();
    const target = addDays(now, 2);
    dailify.current = {
      selectedDay: now,
      tasks: [],
      undatedTasks: [],
      isLoading: false,
      loadedMonths: [startOfMonth(now), startOfMonth(addMonths(now, 1))],
      loadMonth: vi.fn(() => Promise.resolve()),
      targetDay: undefined,
    };
    const { rerender } = render(<DayList />);
    dailify.current = { ...dailify.current, targetDay: target };
    rerender(<DayList />);

    expect(screen.getByText("Nada neste dia")).toBeInTheDocument();
    expect(document.getElementById(dayAnchorId(target))).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  // Back to /dashboard remounts the list with the old target still in context.
  it("não rola de novo ao remontar com o mesmo alvo", () => {
    const now = new Date();
    dailify.current = { ...dailify.current, selectedDay: now, targetDay: addDays(now, 2) };
    render(<DayList />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
