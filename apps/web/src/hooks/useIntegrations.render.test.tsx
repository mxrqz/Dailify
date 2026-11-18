/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ getIntegrations: vi.fn() }));
vi.mock("@/functions/api", () => api);

import { useIntegrations } from "./useIntegrations";

describe("useIntegrations", () => {
  it("fetches once the network comes back when it mounted offline", async () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    api.getIntegrations.mockResolvedValue({ integrations: [] });
    const { result } = renderHook(() => useIntegrations());
    expect(api.getIntegrations).not.toHaveBeenCalled();

    onLine.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event("online")));

    await waitFor(() => expect(result.current).toEqual([]));
    expect(api.getIntegrations).toHaveBeenCalledTimes(1);
  });
});
