/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { addMonths, startOfMonth } from "date-fns";

import { DayList } from "./day-list";

const dailify = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }));
vi.mock("@/components/dailifyContext", () => ({ useDailify: () => dailify.current }));
vi.mock("@/hooks/useExternalEvents", () => ({ useExternalEvents: () => [] }));
// A Mew do primeiro uso observa a própria visibilidade: sairia no lugar da sentinela.
vi.mock("@/components/mew/mew", () => ({ Mew: () => null }));
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

const now0 = () => new Date();

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

    const sentinel = container.querySelector("div[aria-hidden]");
    expect(sentinel).toBeEmptyDOMElement();
    fire?.();
    expect(loadMonth).toHaveBeenCalledWith(startOfMonth(addMonths(now, 2)));
  });

  it("com buraco nos meses carregados pede o primeiro ausente, não o seguinte ao último", () => {
    const { now } = setup({
      loadedMonths: [
        startOfMonth(now0()),
        startOfMonth(addMonths(now0(), 1)),
        startOfMonth(addMonths(now0(), 4)),
      ],
    });
    render(<DayList />);

    fire?.();
    expect(loadMonth).toHaveBeenCalledWith(startOfMonth(addMonths(now, 2)));
  });

  it("skeleton só no boot, antes de haver tarefas", () => {
    setup({ isLoading: "x", tasks: undefined });
    const { getByTestId } = render(<DayList />);
    expect(getByTestId("skeleton")).toBeInTheDocument();
  });

  it("não observa nada enquanto carrega nem depois de 12 meses sem tarefa", () => {
    const { now } = setup({ isLoading: "x" });
    const { rerender, queryByTestId } = render(<DayList />);
    expect(fire).toBeUndefined();
    // Revalidação com lista na tela não troca por skeleton: a rolagem se perderia.
    expect(queryByTestId("skeleton")).toBeNull();

    setup({
      loadedMonths: Array.from({ length: 13 }, (_, i) => startOfMonth(addMonths(now, i))),
    });
    rerender(<DayList />);
    expect(fire).toBeUndefined();
  });
});
