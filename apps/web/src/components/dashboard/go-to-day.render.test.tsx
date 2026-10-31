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
      isLoading: null,
      loadedMonths: [startOfMonth(now), startOfMonth(addMonths(now, 1))],
      loadMonth: vi.fn(() => Promise.resolve()),
      targetDay: target,
    };
    render(<DayList />);

    expect(screen.getByText("Nada neste dia")).toBeInTheDocument();
    expect(document.getElementById(dayAnchorId(target))).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });
});
