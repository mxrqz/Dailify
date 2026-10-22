/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { api, offline, dailify } = vi.hoisted(() => ({
  api: {
    getTasksForMonth: vi.fn(async () => ({ tasks: [] })),
    getQuotas: vi.fn(async () => undefined),
    getPaymentDetails: vi.fn(async () => undefined),
    getInvoices: vi.fn(async () => []),
    getUndatedTasks: vi.fn(async () => ({ tasks: [] })),
    getSettings: vi.fn(async () => ({})),
  },
  offline: {
    flushQueue: vi.fn(),
    cacheTasks: vi.fn(),
    cacheUndated: vi.fn(),
    readCachedTasks: vi.fn(),
    readCachedUndated: vi.fn(),
  },
  dailify: {
    tasks: [],
    selectedDay: new Date(2026, 9, 23),
    setTasks: vi.fn(),
    setIsLoading: vi.fn(),
    isLoading: null,
    setCurrentMonth: vi.fn(),
    currentMonth: undefined,
    setCurrentMonthTasks: vi.fn(),
    setInvoices: vi.fn(),
    setPaymentDetails: vi.fn(),
    setQuotas: vi.fn(),
    undatedTasks: [],
    setUndatedTasks: vi.fn(),
    setWeekStart: vi.fn(),
  },
}));
vi.mock("@/functions/api", () => api);
vi.mock("@/functions/offline", () => offline);
vi.mock("./dailifyContext", () => ({ useDailify: () => dailify }));
vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({
    isSignedIn: true,
    isLoaded: true,
    user: { unsafeMetadata: { timezone: "x" } },
  }),
  useAuth: () => ({ getToken: async () => "token", userId: "u1" }),
}));

import ProtectedRoute from "./protected-route";

describe("<ProtectedRoute>", () => {
  it("lê a Sem data só depois que a fila offline subiu", async () => {
    let flushed!: () => void;
    offline.flushQueue.mockReturnValue(
      new Promise((resolve) => {
        flushed = () => resolve({ sent: 1, dropped: 0, offline: false });
      }),
    );

    render(
      <MemoryRouter>
        <ProtectedRoute>app</ProtectedRoute>
      </MemoryRouter>,
    );

    await waitFor(() => expect(offline.flushQueue).toHaveBeenCalled());
    expect(api.getUndatedTasks).not.toHaveBeenCalled();

    await act(async () => flushed());
    expect(api.getUndatedTasks).toHaveBeenCalledTimes(1);
  });
});
