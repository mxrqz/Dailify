/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { limitsFor, type QuotaUsage } from "@dailify/shared";

const { useSession, dailify, api } = vi.hoisted(() => ({
  useSession: vi.fn(),
  dailify: vi.fn(),
  api: {
    billingPortal: vi.fn(),
    getPaymentDetails: vi.fn(async () => null),
    getInvoices: vi.fn(async () => []),
  },
}));

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  useSession,
}));
vi.mock("@/functions/api", () => api);
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));

import BillingPage from "./billing";
import { copy } from "@/components/dashboard/copy";
import { copy as pricingCopy } from "@/components/pricing/copy";

const session = (user: { plan?: string }) =>
  useSession.mockReturnValue({ data: { user: { id: "u1", ...user } }, refetch: vi.fn() });

const NO_USAGE: QuotaUsage = { tasks: 0, ai: 0 };

const FREE = { limits: limitsFor("free"), usage: NO_USAGE };
const MAX = { limits: limitsFor("max"), usage: NO_USAGE };

/** Só o que a página lê do contexto — o resto do provider não participa da renderização. */
function context(over: Record<string, unknown> = {}) {
  return {
    invoices: undefined,
    paymentDetails: undefined,
    quotas: undefined,
    tasks: [],
    setInvoices: vi.fn(),
    setPaymentDetails: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  session({});
  dailify.mockReturnValue(context());
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <BillingPage />
    </MemoryRouter>,
  );

/**
 * O cartão do plano atual. Escopo importa: o resto da página (cobrança, histórico) não pode
 * emprestar texto pro assert do estado da conta.
 */
function currentPlanCard(): HTMLElement {
  const heading = screen.getByRole("heading", { name: /^Plano (Free|Pro|Max)/ });
  const card = heading.closest("section");
  if (!card) throw new Error("cartão do plano atual não encontrado");
  return card instanceof HTMLElement ? card : screen.getByRole("main");
}

describe("<BillingPage>", () => {
  // O bug de 2026-08: a página inteira sumia para o usuário Free por um gate booleano.
  it("renderiza para usuário Free sem assinatura", () => {
    dailify.mockReturnValue(context({ quotas: FREE }));
    renderPage();

    expect(screen.getByText(pricingCopy.account.title)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plano Free" })).toBeInTheDocument();
    // sem assinatura não há botão de gerenciar plano
    expect(screen.queryByText(pricingCopy.account.manage)).not.toBeInTheDocument();
    // ...mas o Free tem o caminho pros planos
    expect(screen.getByRole("link", { name: pricingCopy.account.seePlans })).toBeInTheDocument();
  });

  // O segundo bug: a derivação sem dados devolvia unlimited, e quem tinha limite lia "ilimitado".
  it("Free mostra o teto real do que é limitado", () => {
    dailify.mockReturnValue(context({ quotas: FREE }));
    renderPage();

    const card = within(currentPlanCard());
    expect(card.getByText(copy.quota.names.tasks)).toBeInTheDocument();
    expect(card.getByText(`0 de ${limitsFor("free").ai}`)).toBeInTheDocument();
    // só tarefas é ilimitada no Free
    expect(card.getByText(pricingCopy.account.unlimited.tasks)).toBeInTheDocument();
    expect(card.queryByText(pricingCopy.account.unlimited.ai)).not.toBeInTheDocument();
  });

  it("os créditos de IA aparecem, não só tarefas — e recorrência não é medida", () => {
    dailify.mockReturnValue(context({ quotas: FREE }));
    renderPage();

    const card = within(currentPlanCard());
    expect(card.getByText(copy.quota.names.ai)).toBeInTheDocument();
    expect(card.queryByText("Recorrentes")).not.toBeInTheDocument();
  });

  it("com quotas ainda carregando, não mostra número nenhum", () => {
    dailify.mockReturnValue(context({ quotas: undefined }));
    renderPage();

    const card = within(currentPlanCard());
    expect(screen.getByText(pricingCopy.account.title)).toBeInTheDocument();
    expect(card.queryByText(copy.quota.names.tasks)).not.toBeInTheDocument();
    expect(card.queryByText(pricingCopy.account.unlimited.tasks)).not.toBeInTheDocument();
  });

  it("assinante vê o plano, a próxima cobrança e o botão de gerenciar", () => {
    session({ plan: "max" });
    dailify.mockReturnValue(
      context({
        quotas: MAX,
        paymentDetails: {
          amount: 1990,
          currency: "brl",
          start: Math.floor(Date.UTC(2026, 8, 10) / 1000),
          recurring: "month",
        },
      }),
    );
    renderPage();

    expect(screen.getByRole("heading", { name: "Plano Max" })).toBeInTheDocument();
    expect(screen.getByText(pricingCopy.account.manage)).toBeInTheDocument();
    expect(screen.getByText(pricingCopy.account.nextCharge)).toBeInTheDocument();

    const card = within(currentPlanCard());
    // tarefas são ilimitadas no Max; os créditos de IA TÊM teto mesmo no plano de cima.
    expect(card.getByText(pricingCopy.account.unlimited.tasks)).toBeInTheDocument();
    expect(card.getByText(`0 de ${limitsFor("max").ai}`)).toBeInTheDocument();
  });

  // A cobrança saiu do boot de toda rota protegida: quem carrega é esta tela.
  it("busca cobrança e faturas ao abrir e guarda no contexto", async () => {
    const ctx = context({ quotas: FREE });
    dailify.mockReturnValue(ctx);
    renderPage();

    await waitFor(() => expect(ctx.setInvoices).toHaveBeenCalledWith([]));
    expect(ctx.setPaymentDetails).toHaveBeenCalledWith(null);
    expect(api.getPaymentDetails).toHaveBeenCalled();
  });

  /**
   * O defeito do bd `iil` era mudo: o preenchimento vem de um translateX manual, entao a barra
   * parecia certa na tela enquanto o Root nunca recebia `value` -- role="progressbar" sem valor
   * nenhum, `data-state` eternamente "indeterminate". So um teste que le ARIA pega isso de volta.
   */
  it("as barras de quota expoem o valor pra leitor de tela", () => {
    session({ plan: "free" });
    dailify.mockReturnValue(
      // Limites fixos: o teste é do ARIA, não da tabela de planos.
      context({
        quotas: {
          limits: { tasks: 30, ai: 5 },
          usage: { ...NO_USAGE, tasks: 15 },
        },
      }),
    );
    renderPage();

    const bars = within(currentPlanCard()).getAllByRole("progressbar");

    // 15 de 30 tarefas = 50%
    expect(bars[0]).toHaveAttribute("aria-valuenow", "50");
    expect(bars[0]).toHaveAttribute("aria-valuemax", "100");
    expect(bars[0]).toHaveAttribute("data-state", "loading");
  });
});
