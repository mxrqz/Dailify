/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useSession,
}));
const { useDailify } = vi.hoisted(() => ({ useDailify: vi.fn() }));
vi.mock("@/components/dailifyContext", () => ({ useDailify }));

import userEvent from "@testing-library/user-event";

import { Sidebar } from "./index";
import { MobileNav } from "./mobile-nav";
import { copy } from "@/components/dashboard/copy";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAppTimeZone, zonedAt } from "@/functions/zone";
import { fill } from "@/functions/functions";
import { forgetUser, rememberUser } from "@/functions/offline";
import { closePanel, usePanel } from "@/hooks/usePanel";

beforeEach(() => {
  useSession.mockReturnValue({
    data: { user: { id: "u1", name: "Seu", email: "seu@mewki.app", image: null } },
  });
  useDailify.mockReturnValue({
    quotas: { limits: { tasks: -1, ai: 30 }, usage: { tasks: 0, ai: 12 } },
  });
  closePanel();
});

function PanelKind(): JSX.Element {
  return <output>{usePanel()?.kind ?? "none"}</output>;
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <TooltipProvider>
        <Sidebar />
        <PanelKind />
      </TooltipProvider>
    </MemoryRouter>,
  );

/** `aria-current="page"` é o contrato: é o que o leitor de tela anuncia e o que o CSS pinta. */
const current = () => screen.queryByRole("link", { current: "page" });

describe("<Sidebar>", () => {
  it("acende só o item da rota atual", () => {
    renderAt("/settings");

    expect(current()).toHaveTextContent(copy.profile.navSettings);
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("cada rota acende o seu", () => {
    const rotas: [string, string][] = [
      ["/dashboard", copy.profile.navDashboard],
      ["/dashboard?view=calendar", copy.profile.navCalendar],
      ["/integrations", copy.profile.navIntegrations],
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

  it("keeps Perfil, Segurança and Sair in the account menu", async () => {
    const user = userEvent.setup();
    renderAt("/dashboard");
    expect(screen.queryByRole("link", { name: copy.profile.navPersonal })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Conta de Seu/ }));

    expect(screen.getByRole("menuitem", { name: copy.profile.navPersonal })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByRole("menuitem", { name: copy.profile.navSecurity })).toHaveAttribute(
      "href",
      "/security",
    );
    expect(screen.getByRole("menuitem", { name: copy.profile.signOut })).toBeInTheDocument();
  });

  it("signed out (/premium): no account menu, an Entrar link instead", () => {
    useSession.mockReturnValue({ data: null });
    renderAt("/premium");
    expect(screen.queryByRole("button", { name: /Conta de/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.header.signIn })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("opens the Mew panel from 'Conversar com a Mew' without lighting it", async () => {
    const user = userEvent.setup();
    renderAt("/settings");
    const mew = screen.getByRole("link", { name: copy.profile.navMew });

    await user.click(mew);

    expect(screen.getByRole("status")).toHaveTextContent("mew");
    expect(mew).not.toHaveAttribute("aria-current");
  });

  it("folds to icons, keeping each item's name, and remembers it", async () => {
    const user = userEvent.setup();
    localStorage.clear();
    const view = renderAt("/settings");
    await user.click(screen.getByRole("button", { name: copy.profile.collapseNav }));

    // The label stays (no jump) and fades; the item keeps its name.
    expect(current()).toHaveAccessibleName(copy.profile.navSettings);
    expect(screen.getByText(copy.profile.navSettings)).toHaveClass("opacity-0");

    view.unmount();
    renderAt("/settings");
    await user.click(screen.getByRole("button", { name: copy.profile.expandNav }));
    expect(screen.getByText(copy.profile.navSettings)).not.toHaveClass("opacity-0");
    localStorage.clear();
  });

  it("counts today's open tasks beside Hoje", () => {
    setAppTimeZone("America/Sao_Paulo");
    const at = (h: number) => +zonedAt(2026, 10, 20, h);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at(10));
    useDailify.mockReturnValue({
      quotas: undefined,
      tasks: [
        { id: "a", title: "A", date: at(9), completed: [] },
        { id: "b", title: "B", date: at(11), completed: [] },
        { id: "c", title: "C", date: at(12), completed: [at(12)] },
      ],
    });
    renderAt("/dashboard");
    expect(
      screen.getByRole("link", { name: `${copy.profile.navDashboard} 2` }),
    ).toBeInTheDocument();
    vi.useRealTimers();
    setAppTimeZone(null);
  });

  it("logado: inicial, plano Free e o medidor de créditos do mês", () => {
    renderAt("/dashboard");
    expect(screen.getByText("S")).toBeInTheDocument();
    expect(screen.getByText("Plano Free")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: copy.quota.names.ai })).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
    expect(screen.getByText("12 de 30 créditos de IA este mês")).toBeInTheDocument();
    expect(screen.getByRole("meter").firstElementChild).toHaveClass("bg-ink");
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

  it("draws a blocked quota (limit 0) as a full bar, not NaN", () => {
    useDailify.mockReturnValue({
      quotas: { limits: { tasks: -1, ai: 0 }, usage: { tasks: 0, ai: 0 } },
    });
    renderAt("/dashboard");
    const fill = screen.getByRole("meter", { name: copy.quota.names.ai }).firstElementChild;
    expect(fill).toHaveStyle({ "--fill": "1" });
    expect(fill).toHaveClass("bg-brand-text");
  });
});

describe("<MobileNav>", () => {
  const open = () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MobileNav />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: copy.header.openNav }));
  };

  it("stays open when the meter, not an item, is tapped", () => {
    open();
    fireEvent.click(screen.getByRole("meter"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes when the current route's item is tapped", () => {
    open();
    fireEvent.click(screen.getByRole("link", { name: copy.profile.navDashboard }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers Free users the upgrade to /premium and closes on tap", () => {
    open();
    const upgrade = screen.getByRole("link", { name: copy.header.upgrade });
    expect(upgrade).toHaveAttribute("href", "/premium");
    fireEvent.click(upgrade);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides the upgrade from paying users", () => {
    useSession.mockReturnValue({
      data: { user: { id: "u1", name: "Seu", email: "seu@mewki.app", image: null, plan: "pro" } },
    });
    open();
    expect(screen.queryByRole("link", { name: copy.header.upgrade })).not.toBeInTheDocument();
  });
});

describe("<Sidebar> upgrade", () => {
  it("offers Free users 'Assinar Pro' to /premium", () => {
    renderAt("/dashboard");
    expect(screen.getByRole("link", { name: copy.profile.upgradePro })).toHaveAttribute(
      "href",
      "/premium",
    );
  });

  it("hides it from paying users", () => {
    useSession.mockReturnValue({
      data: { user: { id: "u1", name: "Seu", email: "seu@mewki.app", image: null, plan: "pro" } },
    });
    renderAt("/dashboard");
    expect(screen.queryByRole("link", { name: copy.profile.upgradePro })).not.toBeInTheDocument();
  });
});

describe("<Sidebar> offline", () => {
  it("shows the last signed-in user when get-session can't reach the server", () => {
    rememberUser({ id: "u1", name: "Offline", email: "off@mewki.app", plan: "pro" });
    useSession.mockReturnValue({ data: null, error: { status: 0 } });
    renderAt("/dashboard");
    expect(
      screen.getByRole("button", { name: fill(copy.profile.accountMenu, { name: "Offline" }) }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: copy.header.signIn })).not.toBeInTheDocument();
    forgetUser();
  });

  it("shows nobody after a 401", () => {
    rememberUser({ id: "u1", name: "Offline", email: "off@mewki.app" });
    useSession.mockReturnValue({ data: null, error: { status: 401 } });
    renderAt("/dashboard");
    expect(screen.getByRole("link", { name: copy.header.signIn })).toBeInTheDocument();
    forgetUser();
  });
});
