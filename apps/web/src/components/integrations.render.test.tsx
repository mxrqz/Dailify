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

import { Integrations, IntegrationsSummary } from "./integrations";
import { copy } from "@/components/dashboard/copy";
import { CALENDAR_DEFAULT_KEY } from "@/hooks/useCalendarDefault";
import { HIDE_EVENTS_KEY } from "@/hooks/useExternalEvents";
import { setIntegrations } from "@/hooks/useIntegrations";

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
      <Integrations />
    </MemoryRouter>,
  );
}

describe("<Integrations>", () => {
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
    expect(toast.success).toHaveBeenCalledWith("Agenda desconectada");
  });

  it("conectado: Mostrar eventos da Agenda nasce ligado e desligar fica no device", async () => {
    localStorage.clear();
    renderWith({ connected: true, status: "active" });
    const toggle = await screen.findByRole("switch", { name: copy.calendar.showEvents });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(localStorage.getItem(HIDE_EVENTS_KEY)).toBe("1");
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

  it("conectado: Novas tarefas na Agenda nasce Nunca e Sempre fica no device", async () => {
    localStorage.clear();
    renderWith({ connected: true, status: "active" });
    const always = await screen.findByRole("radio", { name: t.always });
    expect(screen.getByRole("radio", { name: t.never })).toBeChecked();
    await userEvent.click(always);
    expect(always).toBeChecked();
    expect(localStorage.getItem(CALENDAR_DEFAULT_KEY)).toBe("1");
  });

  it("desconectado não mostra os ajustes da agenda", async () => {
    renderWith();
    await screen.findByRole("button", { name: t.connect });
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: t.always })).not.toBeInTheDocument();
  });
});

describe("<IntegrationsSummary>", () => {
  const summary = () =>
    render(
      <MemoryRouter>
        <IntegrationsSummary />
      </MemoryRouter>,
    );

  it("conectado: conta, ajustes e as duas linhas levam a /integrations", () => {
    setIntegrations([{ ...GCAL, connected: true, status: "active", account: "a@b.com" }]);
    summary();
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: copy.calendar.showEvents })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link"))
      expect(link).toHaveAttribute("href", "/integrations");
  });

  it("desconectado: só o caminho pra conectar, sem ajustes", () => {
    setIntegrations([GCAL]);
    summary();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.all })).toHaveAttribute("href", "/integrations");
  });
});
