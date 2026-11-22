/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { IntegrationStatus } from "@dailify/shared";

const { useOnline, api, toast } = vi.hoisted(() => ({
  useOnline: vi.fn(),
  api: {
    getIntegrations: vi.fn(),
    connectIntegration: vi.fn(),
    disconnectIntegration: vi.fn(),
    revokeReadGrant: vi.fn(),
  },
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/hooks/useOnline", () => ({ useOnline }));
vi.mock("@/functions/api", () => api);
vi.mock("sonner", () => ({ toast }));

import { Integrations, IntegrationsSummary } from "./integrations";
import { copy } from "@/components/dashboard/copy";
import { CALENDAR_DEFAULT_KEY } from "@/hooks/useCalendarDefault";
import { patchIntegration, setIntegrations } from "@/hooks/useIntegrations";

const t = copy.integrations;
const GCAL: IntegrationStatus = {
  provider: "google-calendar",
  allowed: true,
  configured: true,
  connected: false,
};

beforeEach(() => {
  useOnline.mockReturnValue(true);
  setIntegrations(undefined);
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
    expect(api.connectIntegration).toHaveBeenCalledWith("google-calendar");
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
    expect(within(dialog).getByText(/continuam na Mewki/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: t.disconnect }));
    await waitFor(() => expect(api.disconnectIntegration).toHaveBeenCalledWith("google-calendar"));
    expect(await screen.findByRole("button", { name: t.connect })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Agenda desconectada");
  });

  it("an always-read grant shows a switch that revokes it", async () => {
    api.revokeReadGrant.mockResolvedValue({});
    renderWith({ connected: true, status: "active", readAlways: true });
    await userEvent.click(await screen.findByRole("switch", { name: t.readAlways }));
    expect(api.revokeReadGrant).toHaveBeenCalledWith("google-calendar");
    await waitFor(() => expect(screen.queryByRole("switch", { name: t.readAlways })).toBeNull());
  });

  it("conectado: o que ficou só na Agenda vira recado no card", async () => {
    renderWith({ connected: true, status: "active", skipped: 3 });
    expect(await screen.findByText("3 eventos ficaram só na Agenda")).toBeInTheDocument();
  });

  it("connected without the Tasks scope offers a reconnect beside disconnect", async () => {
    api.connectIntegration.mockResolvedValue({});
    renderWith({ connected: true, status: "active", tasksMissing: true });
    expect(await screen.findByText(t.tasksMissing)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.disconnect })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: t.reconnect }));
    expect(api.connectIntegration).toHaveBeenCalledWith("google-calendar");
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
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderWith();
    // Nothing read yet: every provider's card shows, all disabled.
    for (const button of screen.getAllByRole("button", { name: t.connect }))
      expect(button).toBeDisabled();
    expect(screen.getAllByText(t.offlineHint)).toHaveLength(4);
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

  it("follows a store patch made elsewhere, like a revoked calendar", async () => {
    renderWith({ connected: true, status: "active", account: "a@b.com" });
    await screen.findByRole("button", { name: t.disconnect });
    act(() => patchIntegration("google-calendar", { status: "revoked" }));
    expect(await screen.findByRole("button", { name: t.reconnect })).toBeInTheDocument();
  });

  it("a connected Slack card sits above the available calendar and disconnects Slack", async () => {
    api.disconnectIntegration.mockResolvedValue({});
    api.getIntegrations.mockResolvedValue({
      integrations: [
        GCAL,
        {
          ...GCAL,
          provider: "slack",
          connected: true,
          status: "active",
          account: "acme.slack.com",
        },
      ],
    });
    render(
      <MemoryRouter>
        <Integrations />
      </MemoryRouter>,
    );
    const connected = (await screen.findByRole("heading", { name: t.groupConnected }))
      .parentElement;
    if (!connected) throw new Error("no connected group");
    expect(within(connected).getByText("acme.slack.com")).toBeInTheDocument();
    expect(within(connected).queryByRole("radiogroup")).not.toBeInTheDocument();

    await userEvent.click(within(connected).getByRole("button", { name: t.disconnect }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t.apps.slack.disconnectDescription)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: t.disconnect }));
    await waitFor(() => expect(api.disconnectIntegration).toHaveBeenCalledWith("slack"));
    expect(toast.success).toHaveBeenCalledWith("Slack desconectado");
  });

  it("a Free plan locks Slack behind Pro while the calendar connects", async () => {
    api.getIntegrations.mockResolvedValue({
      integrations: [GCAL, { ...GCAL, provider: "slack", allowed: false }],
    });
    render(
      <MemoryRouter>
        <Integrations />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("link", { name: t.pro })).toHaveAttribute("href", "/premium");
    expect(screen.getAllByRole("button", { name: t.connect })).toHaveLength(1);
  });

  it("Gmail gets its own card, connects on its own and left the Em breve list", async () => {
    api.connectIntegration.mockResolvedValue({ url: "https://accounts.google.com/gmail" });
    vi.stubGlobal("location", { ...window.location, assign: vi.fn() });
    api.getIntegrations.mockResolvedValue({
      integrations: [
        { ...GCAL, connected: true, status: "active", account: "a@b.com" },
        { ...GCAL, provider: "gmail" },
      ],
    });
    render(
      <MemoryRouter>
        <Integrations />
      </MemoryRouter>,
    );
    const available = (await screen.findByRole("heading", { name: t.groupAvailable }))
      .parentElement;
    if (!available) throw new Error("no available group");
    for (const line of t.apps.gmail.does)
      expect(within(available).getByText(line)).toBeInTheDocument();
    await userEvent.click(within(available).getByRole("button", { name: t.connect }));
    expect(api.connectIntegration).toHaveBeenCalledWith("gmail");
    const soon = screen.getByRole("heading", { name: t.soon }).parentElement;
    expect(soon && within(soon).queryByText("Gmail")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("GitHub gets its own card with the scope hint, connects and left the Em breve list", async () => {
    api.connectIntegration.mockResolvedValue({ url: "https://github.com/login/oauth/authorize" });
    vi.stubGlobal("location", { ...window.location, assign: vi.fn() });
    api.getIntegrations.mockResolvedValue({
      integrations: [
        { ...GCAL, connected: true, status: "active", account: "a@b.com" },
        { ...GCAL, provider: "github" },
      ],
    });
    render(
      <MemoryRouter>
        <Integrations />
      </MemoryRouter>,
    );
    const available = (await screen.findByRole("heading", { name: t.groupAvailable }))
      .parentElement;
    if (!available) throw new Error("no available group");
    for (const line of t.apps.github.does)
      expect(within(available).getByText(line)).toBeInTheDocument();
    expect(within(available).getByText(t.githubScopeHint)).toBeInTheDocument();
    await userEvent.click(within(available).getByRole("button", { name: t.connect }));
    expect(api.connectIntegration).toHaveBeenCalledWith("github");
    const soon = screen.getByRole("heading", { name: t.soon }).parentElement;
    expect(soon && within(soon).queryByText("GitHub")).toBeNull();
    vi.unstubAllGlobals();
  });

  it("desconectado não mostra os ajustes da agenda", async () => {
    renderWith();
    await screen.findByRole("button", { name: t.connect });
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
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
    expect(screen.getByRole("radiogroup", { name: t.calendarDefault })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link"))
      expect(link).toHaveAttribute("href", "/integrations");
  });

  it("desconectado: só o caminho pra conectar, sem ajustes", () => {
    setIntegrations([GCAL]);
    summary();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.all })).toHaveAttribute("href", "/integrations");
  });
});
