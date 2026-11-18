/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { api, offline, dailify, session } = vi.hoisted(() => ({
  api: {
    getTasksForMonth: vi.fn(async () => ({ tasks: [] })),
    getQuotas: vi.fn(async () => ({})),
    getUndatedTasks: vi.fn(async () => ({ tasks: [] })),
    getSettings: vi.fn(async () => ({})),
  },
  offline: {
    flushQueue: vi.fn(),
    cacheTasks: vi.fn(),
    cacheUndated: vi.fn(),
    readCachedTasks: vi.fn(),
    readCachedUndated: vi.fn(),
    readLastUser: vi.fn(),
    rememberUser: vi.fn(),
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
    selectedDay: new Date(2026, 9, 23),
    setTasks: vi.fn(),
    setIsLoading: vi.fn(),
    isLoading: false,
    loadedMonths: [],
    loadMonth: vi.fn(async () => {}),
    reloadMonths: vi.fn(async () => undefined),
    setQuotas: vi.fn(),
    undatedTasks: [],
    setUndatedTasks: vi.fn(),
    setWeekStart: vi.fn(),
  },
}));
vi.mock("@/functions/api", () => api);
vi.mock("@/functions/offline", () => offline);
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
    vi.clearAllMocks();
    offline.flushQueue.mockResolvedValue({ sent: 0, dropped: 0, offline: false });
    dailify.selectedDay = new Date(2026, 9, 23);
  });

  it("lê a Sem data só depois que a fila offline subiu", async () => {
    let flushed!: () => void;
    offline.flushQueue.mockReturnValue(
      new Promise((resolve) => {
        flushed = () => resolve({ sent: 1, dropped: 0, offline: false });
      }),
    );

    render(app());

    await waitFor(() => expect(offline.flushQueue).toHaveBeenCalled());
    expect(api.getUndatedTasks).not.toHaveBeenCalled();

    await act(async () => flushed());
    expect(api.getUndatedTasks).toHaveBeenCalledTimes(1);
  });

  it("carrega uma vez: re-render com tarefas novas não refaz nenhuma leitura", async () => {
    const { rerender } = render(app());
    await waitFor(() => expect(dailify.reloadMonths).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 3; i++) {
      dailify.tasks = [];
      rerender(app());
    }
    await act(async () => {});

    expect(dailify.reloadMonths).toHaveBeenCalledTimes(1);
    expect(offline.flushQueue).toHaveBeenCalledTimes(1);
    expect(api.getUndatedTasks).toHaveBeenCalledTimes(1);
    expect(api.getQuotas).toHaveBeenCalledTimes(1);
    expect(dailify.loadMonth).not.toHaveBeenCalled();
  });

  it("dia em outro mês só soma aquele mês; a revalidação usa o dia de agora", async () => {
    const { rerender } = render(app());
    await waitFor(() => expect(dailify.reloadMonths).toHaveBeenCalledTimes(1));

    const later = new Date(2027, 2, 10);
    dailify.selectedDay = later;
    rerender(app());
    await waitFor(() => expect(dailify.loadMonth).toHaveBeenCalledWith(later));
    expect(dailify.loadMonth).toHaveBeenCalledTimes(1);
    expect(dailify.reloadMonths).toHaveBeenCalledTimes(1);

    // Reconectar ignora o piso de 30s.
    await act(async () => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(dailify.reloadMonths).toHaveBeenCalledTimes(2));
    expect(dailify.reloadMonths).toHaveBeenLastCalledWith(expect.arrayContaining([later]));
  });

  // O cache da agenda não serializa a cada setTasks; sair da página grava o pendente.
  it("grava o cache adiado e descarrega no pagehide", async () => {
    render(app());
    await act(async () => {});
    expect(offline.cacheTasks).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("pagehide"));
    expect(offline.cacheTasks).toHaveBeenCalledTimes(1);
    expect(offline.cacheTasks).toHaveBeenCalledWith("u1", dailify.tasks);

    // Já gravado: o timer e um segundo pagehide não regravam.
    window.dispatchEvent(new Event("pagehide"));
    expect(offline.cacheTasks).toHaveBeenCalledTimes(1);
  });

  // O splash só segura quem montou carregando: trocar de rota com tudo em mãos abre a rota direto.
  it("carregando mostra o splash e não a rota; com os dados em mãos, a rota sem espera", () => {
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

    it("rede/5xx segue offline com o último usuário e pinta o cache", async () => {
      session.current = () => ({ data: null, error: { status: 503 }, isPending: false });
      offline.readLastUser.mockReturnValue({ id: "u1", name: "", email: "a@b.c" });
      offline.readCachedTasks.mockReturnValue([{ id: "t1" }]);
      Object.assign(dailify, { tasks: undefined });
      try {
        const view = render(app());
        await act(async () => {});
        expect(view.queryByText("login")).toBeNull();
        expect(offline.readCachedTasks).toHaveBeenCalledWith("u1");
        expect(dailify.setTasks).toHaveBeenCalledWith([{ id: "t1" }]);
      } finally {
        Object.assign(dailify, { tasks: [] });
      }
    });

    it("401 é sair de verdade: vai pro /login mesmo com usuário salvo", async () => {
      session.current = () => ({ data: null, error: { status: 401 }, isPending: false });
      offline.readLastUser.mockReturnValue({ id: "u1", name: "", email: "a@b.c" });
      const view = render(app());
      expect(await view.findByText("login")).toBeInTheDocument();
    });
  });
});
