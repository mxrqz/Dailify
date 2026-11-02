/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

import { addDays, startOfDay } from "date-fns";

import { copy } from "@/components/dashboard/copy";
import { dayAnchorId } from "@/components/dashboard/day-section";

const dailify = vi.hoisted(() => vi.fn());
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }));

import { WeekStrip } from "./week-strip";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
const observers: { callback: Callback; rootMargin?: string }[] = [];
class FakeObserver {
  constructor(callback: Callback, options?: IntersectionObserverInit) {
    observers.push({ callback, rootMargin: options?.rootMargin });
  }
  observe() {}
  disconnect() {}
}

const cross = (rootMargin: string, entry: Partial<IntersectionObserverEntry>) =>
  act(() => observers.find((o) => o.rootMargin === rootMargin)?.callback([entry]));

afterEach(() => {
  observers.length = 0;
  vi.unstubAllGlobals();
});

describe("WeekStrip", () => {
  it("acopla ao chegar no topo e só desacopla com folga", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    dailify.mockReturnValue({ tasks: [], goToDay: vi.fn() });

    render(<WeekStrip onCreateOn={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(screen.getByRole("button", { name: copy.day.openCalendar })).toBeTruthy();

    const rect = { x: 0, y: -5, width: 0, height: 0, top: -5, right: 0, bottom: -4, left: 0 };
    const top = { boundingClientRect: { ...rect, toJSON: () => rect } };
    cross("-0px 0px 0px 0px", { isIntersecting: false, ...top });
    expect(document.documentElement.hasAttribute("data-strip-docked")).toBe(true);
    // Acoplada: os mesmos 7 dias e o calendário, nada entra nem sai.
    expect(screen.getAllByRole("button")).toHaveLength(8);

    cross("-8px 0px 0px 0px", { isIntersecting: true, ...top });
    expect(document.documentElement.hasAttribute("data-strip-docked")).toBe(false);
  });

  it("o fundo marca o dia que se está lendo na lista, não hoje", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    dailify.mockReturnValue({ tasks: [], goToDay: vi.fn() });
    const today = startOfDay(new Date());
    // Hoje já passou da linha de leitura e daqui a 2 dias também; daqui a 4 ainda está abaixo.
    const sections = [0, 2, 4].map((offset, i) => {
      const section = document.createElement("section");
      section.id = dayAnchorId(addDays(today, offset));
      const top = [-300, 20, 400][i];
      const rect = { x: 0, y: top, width: 0, height: 0, top, right: 0, bottom: top, left: 0 };
      section.getBoundingClientRect = () => ({ ...rect, toJSON: () => rect });
      document.body.append(section);
      return section;
    });

    render(<WeekStrip onCreateOn={() => {}} />);

    const days = screen.getAllByRole("button");
    expect(days[2].className).toContain("bg-surface-hover");
    expect(days[0].className).not.toMatch(/(^| )bg-surface-hover/);
    for (const section of sections) section.remove();
  });
});
