import type { Invoice, QuotaKey } from "@dailify/shared";

/**
 * Copy de planos e cobrança — landing, `/premium` e `/billing` leem daqui, então o que a página de
 * venda promete e o que a de cobrança mostra não podem divergir. Fonte da verdade do texto: quando
 * houver inglês, é este arquivo que ganha um par.
 *
 * `{n}` em `features.finite` é substituído pelo limite real de `QUOTAS` — nenhum número de plano é
 * digitado aqui.
 */
export const copy = {
  plans: {
    free: {
      name: "Free",
      description: "Pra começar a organizar seu dia sem pagar nada.",
    },
    pro: {
      name: "Pro",
      description: "Mais créditos de IA pra criar falando no dia a dia.",
    },
    max: {
      name: "Max",
      description: "Tudo do Pro, com créditos de IA de sobra pra quem cria tudo falando.",
    },
  },

  /** Uma frase por quota, em duas versões. Quota sem frase não compila. */
  features: {
    /** Not a quota: every plan has it, so it leads every card. */
    tasks: "Tarefas ilimitadas",
    finite: {
      ai: "{n} créditos de IA/mês",
    } satisfies Record<QuotaKey, string>,
    unlimited: {
      ai: "Créditos de IA ilimitados",
    } satisfies Record<QuotaKey, string>,
  },

  billing: {
    monthly: "Mensal",
    yearly: "Anual",
    save: "2 meses grátis",
    perMonth: "/mês",
    perYear: "/ano",
    savings: "Economize {v}",
    freePrice: "Grátis",
    freeNote: "pra sempre",
    recommendedBadge: "Recomendado",
    currentBadge: "Seu plano",
  },

  /** Página `/premium` (escolher plano, pública). */
  page: {
    title: "Planos",
    subtitle: "Comece grátis. Mude de plano quando quiser.",
    cycleLabel: "Cobrança",
    choosePlan: "Assinar {plan}",
    startFree: "Começar grátis",
    currentPlan: "Seu plano atual",
    checkoutFailed: "Não foi possível abrir o checkout. Tente de novo.",
    checkoutSuccess: "Pagamento confirmado. Seu plano é atualizado em instantes.",
    checkoutCanceled: "Checkout cancelado — nada foi cobrado.",
    haveAccount: "Já tem uma conta?",
    signIn: "Faça login",
    creditsTitle: "O que gasta crédito de IA?",
    creditsBody:
      "Áudios, pedidos mais elaborados e ações nas integrações. Tarefas simples, como “comprar pão” ou “reunião toda segunda às 10h30”, não gastam crédito.",
    /** Só afirmação que o produto cumpre: o checkout roda `payment_method_types: ["card"]`, sem trial. */
    fine: "Cartão de crédito (Visa, Mastercard e American Express). Cancele quando quiser e use até o fim do período pago.",
  },

  /** Página `/billing` (assinatura). */
  account: {
    pageTitle: "Mewki — Assinatura",
    title: "Assinatura",
    currentPlan: "Plano {plan}",
    freePrice: "Grátis, pra sempre",
    price: { month: "{amount} por mês", year: "{amount} por ano" },
    cycle: { month: "Mensal", year: "Anual" },
    meter: "{used} de {limit}",
    remaining: "Restam {n}. Renovam em 1º de {month}.",
    /** O valor da linha de quota sem teto; o gênero segue o nome da quota. */
    unlimited: {
      ai: "Ilimitados",
    } satisfies Record<QuotaKey, string>,
    billingTitle: "Cobrança",
    nextCharge: "Próxima cobrança",
    paymentMethod: "Forma de pagamento",
    changePlan: "Trocar de plano",
    changePlanValue: "Free, Pro ou Max",
    manage: "Gerenciar assinatura",
    portalFailed: "Não foi possível abrir a gestão da assinatura. Tente de novo.",
    manageNote:
      "Troque o cartão, mude o ciclo ou cancele. Você continua com acesso até o fim do período pago.",
    seePlans: "Ver planos",
    seePlansNote: "Assine o Pro ou o Max pra ter mais créditos de IA.",
    history: "Histórico de pagamentos",
    noInvoices: "Nenhuma fatura ainda.",
    /** Stripe's invoice status, never shown raw. */
    status: {
      draft: "Rascunho",
      open: "Em aberto",
      paid: "Pago",
      uncollectible: "Não cobrado",
      void: "Anulada",
    } satisfies Record<NonNullable<Invoice["status"]>, string>,
    viewInvoice: "Ver fatura de {date}",
  },
} as const;
