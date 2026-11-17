/** @vitest-environment jsdom */
import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { MISSING_SCOPE_ERROR } from "@dailify/shared";

const { completeIntegration, toast, reloadMonths } = vi.hoisted(() => ({
  reloadMonths: vi.fn(),
  completeIntegration: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/functions/api", () => ({ completeIntegration }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/dailifyContext", () => ({
  useDailify: () => ({ reloadMonths, loadedMonths: [] }),
}));

import IntegrationCallback from "./integration-callback";
import { copy } from "@/components/dashboard/copy";

const t = copy.integrations;

beforeEach(() => {
  vi.clearAllMocks();
});

const renderAt = (query: string) =>
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/integrations/google-calendar/callback?${query}`]}>
        <Routes>
          <Route path="/integrations/:provider/callback" element={<IntegrationCallback />} />
          <Route path="/integrations" element={<p>integrations</p>} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );

describe("<IntegrationCallback>", () => {
  it("sucesso: um POST só (mesmo no StrictMode) e volta pra /integrations", async () => {
    completeIntegration.mockResolvedValue({ integration: {} });
    renderAt("code=c&state=s");

    expect(await screen.findByText("integrations")).toBeInTheDocument();
    expect(completeIntegration).toHaveBeenCalledTimes(1);
    expect(completeIntegration).toHaveBeenCalledWith("google-calendar", "c", "s");
    expect(toast.success).toHaveBeenCalledWith("Agenda conectada");
    expect(reloadMonths).toHaveBeenCalledTimes(1);
  });

  it("access_denied não chama o servidor", async () => {
    renderAt("error=access_denied&state=s");

    expect(await screen.findByText("integrations")).toBeInTheDocument();
    expect(completeIntegration).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Conexão com a Agenda cancelada");
  });

  it("escopo desmarcado vira o recado específico", async () => {
    completeIntegration.mockResolvedValue({
      error: { message: MISSING_SCOPE_ERROR, offline: false, status: 400 },
    });
    renderAt("code=c&state=s");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(t.missingScope.replace("{name}", "Agenda")),
    );
    expect(screen.getByText("integrations")).toBeInTheDocument();
  });

  it("403 avisa que o pedido é de outra conta", async () => {
    completeIntegration.mockResolvedValue({ error: { message: "x", offline: false, status: 403 } });
    renderAt("code=c&state=s");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.wrongUser));
  });
});
