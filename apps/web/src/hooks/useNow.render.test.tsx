/** @vitest-environment jsdom */
import { afterEach, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

import { useNow } from "./useNow";

afterEach(() => vi.useRealTimers());

it("um interval pro app; o minuto re-renderiza, o dia só na virada", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 17, 23, 58, 30));
  const renders = { minute: 0, day: 0 };
  function Clock({ every }: { every: 60_000 | "day" }) {
    useNow(every);
    renders[every === "day" ? "day" : "minute"]++;
    return null;
  }
  render(
    <>
      <Clock every={60_000} />
      <Clock every={60_000} />
      <Clock every="day" />
    </>,
  );
  expect(vi.getTimerCount()).toBe(1);

  act(() => void vi.advanceTimersByTime(60_000)); // 23:59:30
  expect(renders).toEqual({ minute: 4, day: 1 });

  act(() => void vi.advanceTimersByTime(60_000)); // 00:00:30 do dia seguinte
  expect(renders).toEqual({ minute: 6, day: 2 });
});
