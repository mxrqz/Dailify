/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { api, offline, dailify, getToken } = vi.hoisted(() => ({
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
    loadedMonths: [],
    loadMonth: vi.fn(async () => {}),
    reloadMonths: vi.fn(async () => undefined),
    setInvoices: vi.fn(),
    setPaymentDetails: vi.fn(),
    setQuotas: vi.fn(),
    undatedTasks: [],
    setUndatedTasks: vi.fn(),
    setWeekStart: vi.fn(),
  },
  // Estável como o do Clerk (`useCallback` na instância): efeitos que dependem dele não refazem.
  getToken: async () => "token",
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
  useAuth: () => ({ getToken, userId: "u1" }),
}));

import ProtectedRoute from "./protected-route";

// Elemento novo a cada chamada: `rerender` com o mesmo elemento nem re-renderiza.
const app = () => (
  <MemoryRouter>
    <ProtectedRoute>app</ProtectedRoute>
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
    expect(api.getPaymentDetails).toHaveBeenCalledTimes(1);
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

  // O splash só segura quem montou carregando: trocar de rota com tudo em mãos abre a rota direto.
  it("carregando mostra o splash e não a rota; com os dados em mãos, a rota sem espera", () => {
    Object.assign(dailify, { isLoading: "x", tasks: undefined });
    try {
      const loading = render(app());
      expect(loading.queryByText("app")).toBeNull();
      expect(loading.getByRole("status")).toBeInTheDocument();
      loading.unmount();
    } finally {
      Object.assign(dailify, { isLoading: null, tasks: [] });
    }

    expect(render(app()).getByText("app")).toBeInTheDocument();
  });
});
