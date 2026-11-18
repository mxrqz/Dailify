/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ createTaskVoice: vi.fn() }));
vi.mock("@/functions/api", () => api);
vi.mock("@/lib/auth", () => ({
  useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
}));
vi.mock("@/components/dailifyContext", () => ({
  useDailify: () => ({ bumpUsage: vi.fn(), setTasks: vi.fn(), setUndatedTasks: vi.fn() }),
}));

import { useVoiceCreate } from "./useVoiceCreate";

describe("useVoiceCreate", () => {
  it("cancelling during the permission prompt releases the mic and never records", async () => {
    const track = { stop: vi.fn() };
    let grant: (stream: unknown) => void = () => {};
    const getUserMedia = vi.fn(() => new Promise((resolve) => (grant = resolve)));
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    const recorder = vi.fn();
    vi.stubGlobal("MediaRecorder", Object.assign(recorder, { isTypeSupported: () => true }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>{children}</MemoryRouter>
    );
    const { result, unmount } = renderHook(() => useVoiceCreate(), { wrapper });

    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = result.current.start();
    });
    unmount();
    await act(async () => {
      grant({ getTracks: () => [track] });
      await started;
    });

    expect(track.stop).toHaveBeenCalled();
    expect(recorder).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
