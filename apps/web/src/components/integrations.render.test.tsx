/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { IntegrationStatus } from "@dailify/shared";

const { useAuth, useOnline, api, toast } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useOnline: vi.fn(),
  api: {
    getIntegrations: vi.fn(),
    connectIntegration: vi.fn(),
    disconnectIntegration: vi.fn(),
  },
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@clerk/clerk-react", () => ({ useAuth }));
vi.mock("@/hooks/useOnline", () => ({ useOnline }));
vi.mock("@/functions/api", () => api);
vi.mock("sonner", () => ({ toast }));

import { IntegrationsGroup } from "./integrations";
import { copy } from "@/components/dashboard/copy";

const t = copy.integrations;
const GCAL: IntegrationStatus = {
  provider: "google-calendar",
  allowed: true,
  configured: true,
  connected: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ getToken: async () => "t" });
  useOnline.mockReturnValue(true);
});

function renderWith(status?: Partial<IntegrationStatus>) {
  api.getIntegrations.mockResolvedValue({ integrations: [{ ...GCAL, ...status }] });
  return render(
    <MemoryRouter>
      <IntegrationsGroup />
    </MemoryRouter>,
  );
}

describe("<IntegrationsGroup>", () => {
  it("não conectado: Conectar leva à URL do provedor", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    api.connectIntegration.mockResolvedValue({ url: "https://accounts.google.com/x" });
    renderWith();

    await userEvent.click(await screen.findByRole("button", { name: t.connect }));
    expect(api.connectIntegration).toHaveBeenCalledWith("t", "google-calendar");
    expect(assign).toHaveBeenCalledWith("https://accounts.google.com/x");
    vi.unstubAllGlobals();
  });

  it("conectado mostra a conta e desconecta só depois de confirmar", async () => {
    api.disconnectIntegration.mockResolvedValue({});
    renderWith({ connected: true, status: "active", account: "a@b.com" });

    expect(await screen.findByText("a@b.com")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: t.disconnect }));
    expect(api.disconnectIntegration).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: t.disconnect }));
    await waitFor(() =>
      expect(api.disconnectIntegration).toHaveBeenCalledWith("t", "google-calendar"),
    );
    expect(await screen.findByRole("button", { name: t.connect })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Google Agenda desconectado");
  });

  it("revogado pede pra reconectar", async () => {
    renderWith({ connected: true, status: "revoked", account: "a@b.com" });
    expect(await screen.findByRole("button", { name: t.reconnect })).toBeEnabled();
    expect(screen.getByText(t.revokedHint)).toBeInTheDocument();
  });

  it("fora do plano vira o cadeado do Pro apontando pra /premium", async () => {
    renderWith({ allowed: false });
    expect(await screen.findByRole("link", { name: t.pro })).toHaveAttribute("href", "/premium");
    expect(screen.queryByRole("button", { name: t.connect })).not.toBeInTheDocument();
  });

  it("503 no connect vira Em breve desabilitado", async () => {
    api.connectIntegration.mockResolvedValue({
      error: { message: "x", offline: false, status: 503 },
    });
    renderWith();

    await userEvent.click(await screen.findByRole("button", { name: t.connect }));
    expect(await screen.findByRole("button", { name: t.soon })).toBeDisabled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("servidor sem credencial: Em breve logo de cara", async () => {
    renderWith({ configured: false });
    expect(await screen.findByRole("button", { name: t.soon })).toBeDisabled();
    expect(screen.queryByRole("button", { name: t.connect })).not.toBeInTheDocument();
  });

  it("offline desabilita e não busca", () => {
    useOnline.mockReturnValue(false);
    renderWith();
    expect(screen.getByRole("button", { name: t.connect })).toBeDisabled();
    expect(screen.getByText(t.offlineHint)).toBeInTheDocument();
    expect(api.getIntegrations).not.toHaveBeenCalled();
  });
});
