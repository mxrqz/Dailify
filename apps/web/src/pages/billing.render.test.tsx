/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { limitsFor, type QuotaUsage } from "@dailify/shared";

const { useUser, useAuth, dailify } = vi.hoisted(() => ({
  useUser: vi.fn(),
  useAuth: vi.fn(),
  dailify: vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({ useUser, useAuth }));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));

import BillingPage from "./billing";
import { copy } from "@/components/dashboard/copy";

const NO_USAGE: QuotaUsage = { tasks: 0, recurring: 0, voice: 0 };

const FREE = { limits: limitsFor("free"), usage: NO_USAGE };
const PRO_AI = { limits: limitsFor("pro+ai"), usage: NO_USAGE };

/** Só o que a página lê do contexto — o resto do provider não participa da renderização. */
function context(over: Record<string, unknown> = {}) {
  return {
    invoices: undefined,
    paymentDetails: undefined,
    quotas: undefined,
    tasks: [],
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ getToken: async () => "t" });
  useUser.mockReturnValue({ user: { publicMetadata: {} } });
  dailify.mockReturnValue(context());
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <BillingPage />
    </MemoryRouter>,
  );

/**
 * O cartão do plano atual. Escopo importa: a tabela de planos logo abaixo também diz "Tarefas
 * ilimitadas" (é o bullet do Pro+AI), e um assert na página inteira leria o anúncio como se fosse
 * o estado da conta.
 */
function currentPlanCard(): HTMLElement {
  // `/^Plano (Free|Pro)/` e não `/^Plano/`: o título do card é "Plano e assinatura" e casaria também.
  const heading = screen.getByRole("heading", { name: /^Plano (Free|Pro)/ });
  const card = heading.closest("div.rounded-lg");
  if (!card) throw new Error("cartão do plano atual não encontrado");
  return card instanceof HTMLElement ? card : screen.getByRole("main");
}

describe("<BillingPage>", () => {
  // O bug de 2026-08: a página inteira sumia para o usuário Free por um gate booleano.
  it("renderiza para usuário Free sem assinatura", () => {
    dailify.mockReturnValue(context({ quotas: FREE }));
    renderPage();

    expect(screen.getByText(copy.profile.billingTitle)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plano Free" })).toBeInTheDocument();
    // sem assinatura não há botão de gerenciar plano
    expect(screen.queryByText(copy.profile.billingManage)).not.toBeInTheDocument();
  });

  // O segundo bug: a derivação sem dados devolvia unlimited, e quem tinha 30/mês lia "ilimitado".
  it("Free não anuncia nada de ilimitado", () => {
    dailify.mockReturnValue(context({ quotas: FREE }));
    renderPage();

    const card = within(currentPlanCard());
    expect(card.getByText(copy.quota.names.tasks)).toBeInTheDocument();
    expect(card.getByText("0 / 30")).toBeInTheDocument();
    // nenhuma das três quotas do Free é ilimitada
    expect(card.queryByText(new RegExp(copy.quota.unlimited))).not.toBeInTheDocument();
  });

  it("as três quotas aparecem, não só tarefas", () => {
    dailify.mockReturnValue(context({ quotas: FREE }));
    renderPage();

    const card = within(currentPlanCard());
    expect(card.getByText(copy.quota.names.recurring)).toBeInTheDocument();
    expect(card.getByText(copy.quota.names.voice)).toBeInTheDocument();
  });

  it("com quotas ainda carregando, não mostra número nenhum", () => {
    dailify.mockReturnValue(context({ quotas: undefined }));
    renderPage();

    const card = within(currentPlanCard());
    expect(screen.getByText(copy.profile.billingTitle)).toBeInTheDocument();
    expect(card.queryByText(copy.quota.names.tasks)).not.toBeInTheDocument();
    expect(card.queryByText(new RegExp(copy.quota.unlimited))).not.toBeInTheDocument();
  });

  it("assinante vê o plano, a próxima cobrança e o botão de gerenciar", () => {
    useUser.mockReturnValue({ user: { publicMetadata: { plan: "pro+ai" } } });
    dailify.mockReturnValue(
      context({
        quotas: PRO_AI,
        paymentDetails: {
          amount: 1990,
          currency: "brl",
          start: Math.floor(Date.UTC(2026, 8, 10) / 1000),
          recurring: "month",
        },
      }),
    );
    renderPage();

    expect(screen.getByRole("heading", { name: "Plano Pro + AI" })).toBeInTheDocument();
    expect(screen.getByText(copy.profile.billingManage)).toBeInTheDocument();

    const card = within(currentPlanCard());
    // tarefas e recorrentes são ilimitadas no Pro+AI; a voz TEM teto mesmo no plano de cima.
    expect(card.getAllByText(`0 / ${copy.quota.unlimited}`)).toHaveLength(2);
    expect(card.getByText("0 / 200")).toBeInTheDocument();
  });
});
