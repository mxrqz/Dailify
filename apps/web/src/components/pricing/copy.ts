import type { QuotaKey } from "@dailify/shared";

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
      description:
        "Dez vezes mais tarefas e dez vezes mais recorrência pra quem já vive no Dailify.",
    },
    "pro+ai": {
      name: "Pro+AI",
      description: "Tarefas e recorrência sem teto, e voz de sobra pra criar falando.",
    },
  },

  /** Uma frase por quota, em duas versões. Quota sem frase não compila. */
  features: {
    finite: {
      tasks: "{n} tarefas/mês",
      recurring: "{n} tarefas recorrentes",
      voice: "{n} comandos de voz/mês",
    } satisfies Record<QuotaKey, string>,
    unlimited: {
      tasks: "Tarefas ilimitadas",
      recurring: "Recorrência ilimitada",
      voice: "Comandos de voz ilimitados",
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
  },

  /** Página `/premium` (escolher plano, pública). */
  page: {
    eyebrow: "// PLANOS",
    title: "Escolha o plano perfeito para você",
    subtitle: "Todos os planos têm tudo. O que muda é quanto cabe.",
    choosePlan: "Assinar",
    signInFirst: "Entre na sua conta pra assinar.",
    checkoutFailed: "Não foi possível abrir o checkout. Tente de novo.",
    checkoutSuccess: "Pagamento confirmado. Seu plano é atualizado em instantes.",
    checkoutCanceled: "Checkout cancelado — nada foi cobrado.",
    haveAccount: "Já tem uma conta?",
    signIn: "Faça login",
    faqTitle: "Perguntas frequentes",
  },

  /**
   * FAQ — só afirmação que o produto cumpre. O checkout roda `payment_method_types: ["card"]` e
   * `subscription_data` sem `trial_period_days`, então nada de trial nem de Pix/PayPal aqui.
   */
  faqs: [
    {
      question: "Posso mudar de plano depois?",
      answer:
        "Pode, a qualquer momento. Upgrade ou downgrade entram em vigor no próximo ciclo de cobrança.",
    },
    {
      question: "Quais formas de pagamento são aceitas?",
      answer: "Cartão de crédito (Visa, Mastercard e American Express).",
    },
    {
      question: "Posso cancelar quando quiser?",
      answer:
        "Sim. O cancelamento é feito em Premium › Gerenciar plano, e você continua com acesso até o fim do período já pago.",
    },
    {
      question: "O que acontece se eu passar do limite de tarefas?",
      answer:
        "Suas tarefas continuam lá e você segue gerenciando elas normalmente — só a criação de novas fica bloqueada até o próximo ciclo ou até você mudar de plano.",
    },
  ],

  /** Bloco de planos dentro de `/billing`. */
  billingSection: {
    titleFree: "Escolha um plano",
    titleSubscribed: "Trocar de plano",
    description: "A cobrança é ajustada proporcionalmente no próximo ciclo.",
  },
} as const;
