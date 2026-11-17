/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useSession,
}));
const { useDailify } = vi.hoisted(() => ({ useDailify: vi.fn() }));
vi.mock("@/components/dailifyContext", () => ({ useDailify }));

import { Sidebar } from "./index";
import { copy } from "@/components/dashboard/copy";

beforeEach(() => {
  vi.clearAllMocks();
  useSession.mockReturnValue({
    data: { user: { id: "u1", name: "Seu", email: "seu@mewki.app", image: null } },
  });
  useDailify.mockReturnValue({
    quotas: { limits: { tasks: -1, ai: 30 }, usage: { tasks: 0, ai: 12 } },
  });
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );

/** `aria-current="page"` é o contrato: é o que o leitor de tela anuncia e o que o CSS pinta. */
const current = () => screen.queryByRole("link", { current: "page" });

describe("<Sidebar>", () => {
  it("acende só o item da rota atual", () => {
    renderAt("/security");

    expect(current()).toHaveTextContent(copy.profile.navSecurity);
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("cada rota acende o seu", () => {
    const rotas: [string, string][] = [
      ["/dashboard", copy.profile.navDashboard],
      ["/profile", copy.profile.navPersonal],
      ["/settings", copy.profile.navSettings],
      ["/billing", copy.profile.navPremium],
    ];
    for (const [path, label] of rotas) {
      const { unmount } = renderAt(path);
      expect(current()).toHaveTextContent(label);
      unmount();
    }
  });

  // O comportamento que o comentário do SidebarItem documenta: o destaque marca o assunto, não o
  // destino — /premium acende "Premium", que aponta para /billing.
  it("/premium acende Premium mesmo apontando para /billing", () => {
    renderAt("/premium");
    const active = current();
    expect(active).toHaveTextContent(copy.profile.navPremium);
    expect(active).toHaveAttribute("href", "/billing");
  });

  it("rota fora da navegação não acende nada", () => {
    renderAt("/task/abc");
    expect(current()).toBeNull();
  });

  it("'Sair' só aparece logado", () => {
    const { unmount } = renderAt("/dashboard");
    expect(screen.getByText(copy.profile.signOut)).toBeInTheDocument();
    unmount(); // o cleanup automático só roda entre testes, não entre renders do mesmo teste

    useSession.mockReturnValue({ data: null });
    renderAt("/premium");
    expect(screen.queryByText(copy.profile.signOut)).not.toBeInTheDocument();
  });

  it("logado: inicial, plano Free e o medidor de créditos do mês", () => {
    renderAt("/dashboard");
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: copy.quota.names.ai })).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
    expect(screen.getByText("12 de 30 créditos de IA este mês")).toBeInTheDocument();
  });

  it("créditos ilimitados ou carregando: sem medidor", () => {
    useDailify.mockReturnValue({
      quotas: { limits: { tasks: -1, ai: -1 }, usage: { tasks: 0, ai: 3 } },
    });
    const { unmount } = renderAt("/dashboard");
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    unmount();

    useDailify.mockReturnValue({ quotas: undefined });
    renderAt("/dashboard");
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});
