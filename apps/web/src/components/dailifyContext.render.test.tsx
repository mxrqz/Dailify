/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";

const { api } = vi.hoisted(() => ({ api: { getTasksForMonth: vi.fn(), syncTasks: vi.fn() } }));
vi.mock("@/functions/api", () => api);

import { DailifyProvider, useDailify } from "./dailifyContext";
import { setAppTimeZone, zonedAt } from "@/functions/zone";

function mount() {
  let ctx!: ReturnType<typeof useDailify>;
  const Probe = () => {
    ctx = useDailify();
    return null;
  };
  render(
    <DailifyProvider>
      <Probe />
    </DailifyProvider>,
  );
  return () => ctx;
}

beforeEach(() => {
  setAppTimeZone("America/Sao_Paulo");
  // Mid-month noon: "today" and the months goToDay walks never move under the test.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(zonedAt(2026, 9, 21, 12));
  api.getTasksForMonth.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  setAppTimeZone(null);
});

describe("<DailifyProvider>", () => {
  it("goToDay inside the synced window expands the months locally", async () => {
    const get = mount();
    const day = zonedAt(2027, 0, 10);
    await act(() => get().goToDay(day));
    expect(api.getTasksForMonth).not.toHaveBeenCalled();
    expect(get().loadedMonths.map(Number)).toContain(+zonedAt(2027, 0, 1));
    expect(get().targetDay).toEqual(day);
  });

  it("goToDay before the window fetches only the older months, then marks the target", async () => {
    const replies: (() => void)[] = [];
    api.getTasksForMonth.mockImplementation(
      () => new Promise((resolve) => replies.push(() => resolve({ tasks: [] }))),
    );
    const get = mount();
    // The window starts on April 21st: March and the straddled April come from the server.
    const day = zonedAt(2026, 2, 15);

    let going!: Promise<void>;
    await act(async () => {
      going = get().goToDay(day);
      await vi.waitFor(() => expect(replies).toHaveLength(2));
    });
    const asked = api.getTasksForMonth.mock.calls.map(([m]) => +m);
    expect(asked).toEqual([+zonedAt(2026, 2, 1), +zonedAt(2026, 3, 1)]);
    expect(get().targetDay).toBeUndefined();

    await act(async () => {
      replies.forEach((reply) => reply());
      await going;
    });
    expect(get().targetDay).toEqual(day);
  });
});
