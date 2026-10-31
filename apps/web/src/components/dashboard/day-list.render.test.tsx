/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { addMonths, startOfMonth } from "date-fns";

import { DayList } from "./day-list";

const dailify = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("@/components/dailifyContext", () => ({ useDailify: () => dailify.current }));
vi.mock("@/components/dashboard/day-section", () => ({
  DaySection: () => <section />,
  TaskSkeletons: () => <div data-testid="skeleton" />,
}));

const loadMonth = vi.fn(() => Promise.resolve());
let fire: (() => void) | undefined;

beforeEach(() => {
  loadMonth.mockClear();
  fire = undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        fire = () => cb([{ isIntersecting: true }]);
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

function setup(over: Record<string, unknown> = {}) {
  const now = new Date();
  dailify.current = {
    selectedDay: now,
    tasks: [],
    undatedTasks: [],
    isLoading: null,
    loadedMonths: [startOfMonth(now), startOfMonth(addMonths(now, 1))],
    loadMonth,
    ...over,
  };
  return { now };
}

describe("<DayList>", () => {
  it("a sentinela é vazia e invisível, e ao cruzar pede o mês seguinte ao último", () => {
    const { now } = setup();
    const { container } = render(<DayList />);

    const sentinel = container.querySelector("[aria-hidden]");
    expect(sentinel).toBeEmptyDOMElement();
    fire?.();
    expect(loadMonth).toHaveBeenCalledWith(startOfMonth(addMonths(now, 2)));
  });

  it("não observa nada enquanto carrega nem depois de 12 meses sem tarefa", () => {
    const { now } = setup({ isLoading: "x" });
    const { rerender } = render(<DayList />);
    expect(fire).toBeUndefined();

    setup({
      loadedMonths: [startOfMonth(now), startOfMonth(addMonths(now, 12))],
    });
    rerender(<DayList />);
    expect(fire).toBeUndefined();
  });
});
