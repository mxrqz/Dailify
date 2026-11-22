/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { api, offline, store, dailify, session } = vi.hoisted(() => ({
  api: {
    getQuotas: vi.fn(async () => ({})),
    getSettings: vi.fn(async () => ({})),
  },
  offline: {
    flushQueue: vi.fn(),
    readLastUser: vi.fn(),
    rememberUser: vi.fn(),
  },
  store: {
    openTasks: vi.fn(async () => {}),
    pullTasks: vi.fn(
      async (): Promise<{ message: string; offline: boolean } | undefined> => undefined,
    ),
    tasksSnapshot: () => ({ dated: [], undated: [], months: [] }),
  },
  session: {
    current: (): { data: unknown; error: unknown; isPending: boolean } => ({
      data: { user: { id: "u1" } },
      error: null,
      isPending: false,
    }),
  },
  dailify: {
    tasks: [],
    setTasks: vi.fn(),
    setIsLoading: vi.fn(),
    isLoading: false,
    setQuotas: vi.fn(),
    setUndatedTasks: vi.fn(),
    setWeekStart: vi.fn(),
  },
}));
vi.mock("@/functions/api", () => api);
vi.mock("@/functions/offline", () => offline);
vi.mock("@/functions/task-store", () => store);
vi.mock("./dailifyContext", () => ({ useDailify: () => dailify, reportLoadError: vi.fn() }));
// Objeto novo a cada render, como o do Better Auth no refetch: o gate depende do id, não dele.
vi.mock("@/lib/auth", () => ({
  useSession: () => session.current(),
}));

import ProtectedRoute from "./protected-route";

// Elemento novo a cada chamada: `rerender` com o mesmo elemento nem re-renderiza.
const app = () => (
  <MemoryRouter>
    <Routes>
      <Route path="/" element={<ProtectedRoute>app</ProtectedRoute>} />
      <Route path="/login" element={<p>login</p>} />
    </Routes>
  </MemoryRouter>
);

describe("<ProtectedRoute>", () => {
  beforeEach(() => {
    offline.flushQueue.mockResolvedValue({ sent: 0, dropped: 0, offline: false });
  });

  it("opens the store, then flushes the outbox, and only then pulls", async () => {
    let flushed!: () => void;
    offline.flushQueue.mockReturnValue(
      new Promise((resolve) => {
        flushed = () => resolve({ sent: 1, dropped: 0, offline: false });
      }),
    );

    render(app());

    await waitFor(() => expect(offline.flushQueue).toHaveBeenCalledWith("u1"));
    expect(store.openTasks).toHaveBeenCalledWith("u1");
    expect(store.pullTasks).not.toHaveBeenCalled();

    await act(async () => flushed());
    expect(store.pullTasks).toHaveBeenCalledTimes(1);
  });

  it("boots once: re-renders with new tasks redo no read", async () => {
    const { rerender } = render(app());
    await waitFor(() => expect(store.pullTasks).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 3; i++) {
      dailify.tasks = [];
      rerender(app());
    }
    await act(async () => {});

    expect(store.pullTasks).toHaveBeenCalledTimes(1);
    expect(offline.flushQueue).toHaveBeenCalledTimes(1);
    expect(api.getSettings).toHaveBeenCalledTimes(1);
    expect(api.getQuotas).toHaveBeenCalledTimes(1);
  });

  it("going online flushes and pulls again, ignoring the 30 s floor", async () => {
    render(app());
    await waitFor(() => expect(store.pullTasks).toHaveBeenCalledTimes(1));

    await act(async () => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(store.pullTasks).toHaveBeenCalledTimes(2));
    expect(offline.flushQueue).toHaveBeenCalledTimes(2);
  });

  it("fills empty lists when neither the store nor the pull had any", async () => {
    store.pullTasks.mockResolvedValueOnce({ message: "", offline: true });
    render(app());
    await waitFor(() => expect(dailify.setTasks).toHaveBeenCalled());
    const [fill] = dailify.setTasks.mock.calls[0];
    expect(fill(undefined)).toEqual([]);
    expect(fill([1])).toEqual([1]);
  });

  it("boots the other account when the user changes", async () => {
    const original = session.current;
    try {
      const view = render(app());
      await waitFor(() => expect(store.openTasks).toHaveBeenCalledWith("u1"));
      session.current = () => ({ data: { user: { id: "u2" } }, error: null, isPending: false });
      view.rerender(app());
      await waitFor(() => expect(store.openTasks).toHaveBeenCalledWith("u2"));
      expect(store.pullTasks).toHaveBeenCalledTimes(2);
    } finally {
      session.current = original;
    }
  });

  // O splash só segura quem montou carregando: trocar de rota com tudo em mãos abre a rota direto.
  it("shows the splash and not the route while loading; with data in hand, the route at once", () => {
    Object.assign(dailify, { isLoading: true, tasks: undefined });
    try {
      const loading = render(app());
      expect(loading.queryByText("app")).toBeNull();
      expect(loading.getByRole("status")).toBeInTheDocument();
      loading.unmount();
    } finally {
      Object.assign(dailify, { isLoading: false, tasks: [] });
    }

    expect(render(app()).getByText("app")).toBeInTheDocument();
  });

  describe("get-session sem resposta", () => {
    const original = session.current;
    afterEach(() => {
      session.current = original;
    });

    it("a network or 5xx error goes on offline with the last user and paints their store", async () => {
      session.current = () => ({ data: null, error: { status: 503 }, isPending: false });
      offline.readLastUser.mockReturnValue({ id: "u1", name: "", email: "a@b.c" });
      Object.assign(dailify, { tasks: undefined });
      try {
        const view = render(app());
        await act(async () => {});
        expect(view.queryByText("login")).toBeNull();
        expect(store.openTasks).toHaveBeenCalledWith("u1");
      } finally {
        Object.assign(dailify, { tasks: [] });
      }
    });

    it("a 401 is a real sign-out: /login even with a saved user", async () => {
      session.current = () => ({ data: null, error: { status: 401 }, isPending: false });
      offline.readLastUser.mockReturnValue({ id: "u1", name: "", email: "a@b.c" });
      const view = render(app());
      expect(await view.findByText("login")).toBeInTheDocument();
    });
  });
});
