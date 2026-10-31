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

describe("WeekStrip (mobile)", () => {
  it("acopla no header ao encostar na barra e só desacopla com folga", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    const setStripDocked = vi.fn();
    dailify.mockReturnValue({ tasks: [], goToDay: vi.fn(), setStripDocked });

    render(<WeekStrip />);
    expect(screen.getAllByRole("button")).toHaveLength(8);
    expect(screen.getByRole("button", { name: copy.day.openCalendar })).toBeTruthy();

    const rect = { x: 0, y: 30, width: 0, height: 0, top: 30, right: 0, bottom: 30, left: 0 };
    const top = { boundingClientRect: { ...rect, toJSON: () => rect } };
    cross("-40px 0px 0px 0px", { intersectionRatio: 0.5, ...top });
    expect(setStripDocked).toHaveBeenLastCalledWith(true);
    // Acoplada: os mesmos 7 dias e o calendário, nada entra nem sai.
    expect(screen.getAllByRole("button")).toHaveLength(8);

    cross("-48px 0px 0px 0px", { intersectionRatio: 1, ...top });
    expect(setStripDocked).toHaveBeenLastCalledWith(false);
  });

  it("o fundo marca o dia que se está lendo na lista, não hoje", () => {
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    dailify.mockReturnValue({ tasks: [], goToDay: vi.fn(), setStripDocked: vi.fn() });
    const section = document.createElement("section");
    section.id = dayAnchorId(addDays(startOfDay(new Date()), 2));
    document.body.append(section);

    render(<WeekStrip />);
    cross("-48px 0px -60% 0px", { target: section, isIntersecting: true });

    const days = screen.getAllByRole("button");
    expect(days[2].className).toContain("bg-surface-hover");
    expect(days[0].className).not.toMatch(/(^| )bg-surface-hover/);
    section.remove();
  });
});
