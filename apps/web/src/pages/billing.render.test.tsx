/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Permissions } from "@dailify/shared";

const { useUser, useAuth, dailify } = vi.hoisted(() => ({
  useUser: vi.fn(),
  useAuth: vi.fn(),
  dailify: vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({ useUser, useAuth }));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));

import BillingPage from "./billing";
import { copy } from "@/components/dashboard/copy";

const FREE: Permissions = {
  taskLimits: { monthly: 30, recurring: 0 },
  features: { voiceCreation: false },
};
const PRO_AI: Permissions = {
  taskLimits: { monthly: -1, recurring: -1 },
  features: { voiceCreation: true },
};

/** Só o que a página lê do contexto — o resto do provider não participa da renderização. */
function context(over: Record<string, unknown> = {}) {
  return {
    invoices: undefined,
    paymentDetails: undefined,
    permissions: undefined,
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
    dailify.mockReturnValue(context({ permissions: FREE }));
    renderPage();

    expect(screen.getByText(copy.profile.billingTitle)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plano Free" })).toBeInTheDocument();
    // sem assinatura não há botão de gerenciar plano
    expect(screen.queryByText(copy.profile.billingManage)).not.toBeInTheDocument();
  });

  // O segundo bug: computeEntitlements(undefined) devolvia unlimited, e quem tinha 30/mês lia
  // "Tarefas ilimitadas".
  it("Free não anuncia tarefas ilimitadas", () => {
    dailify.mockReturnValue(context({ permissions: FREE }));
    renderPage();

    const card = within(currentPlanCard());
    expect(card.getByText(copy.profile.billingTasksUsed)).toBeInTheDocument();
    expect(card.queryByText(copy.profile.billingUnlimitedTasks)).not.toBeInTheDocument();
    expect(card.getByText("0 / 30")).toBeInTheDocument();
  });

  it("com permissões ainda carregando, não mostra número de tarefa nenhum", () => {
    dailify.mockReturnValue(context({ permissions: undefined }));
    renderPage();

    const card = within(currentPlanCard());
    expect(screen.getByText(copy.profile.billingTitle)).toBeInTheDocument();
    expect(card.queryByText(copy.profile.billingTasksUsed)).not.toBeInTheDocument();
    expect(card.queryByText(copy.profile.billingUnlimitedTasks)).not.toBeInTheDocument();
  });

  it("assinante vê o plano, a próxima cobrança e o botão de gerenciar", () => {
    useUser.mockReturnValue({ user: { publicMetadata: { plan: "pro+ai" } } });
    dailify.mockReturnValue(
      context({
        permissions: PRO_AI,
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
    expect(
      within(currentPlanCard()).getByText(copy.profile.billingUnlimitedTasks),
    ).toBeInTheDocument();
  });
});
