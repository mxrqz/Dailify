/**
 * Copy de planos e cobrança — landing, `/premium` e `/billing` leem daqui, então o que a página de
 * venda promete e o que a de cobrança mostra não podem divergir. Fonte da verdade do texto: quando
 * houver inglês, é este arquivo que ganha um par.
 *
 * `{n}` em `monthlyTasks` é substituído pelo limite real de `PLAN_PERMISSIONS` — nenhum número de
 * plano é digitado aqui.
 */
export const copy = {
  plans: {
    free: {
      name: "Free",
      description: "Pra começar a organizar seu dia sem pagar nada.",
    },
    pro: {
      name: "Pro",
      description: "Mais tarefas por mês e recorrência ilimitada pra quem já vive no Dailify.",
    },
    "pro+ai": {
      name: "Pro+AI",
      description: "Tudo do Pro, mais criação de tarefa por voz.",
    },
  },

  /** Bullets derivados de `PLAN_PERMISSIONS`. Só existe bullet pro que o servidor entrega. */
  features: {
    unlimitedTasks: "Tarefas ilimitadas",
    monthlyTasks: "{n} tarefas/mês",
    unlimitedRecurrence: "Recorrência ilimitada",
    voiceCreation: "Criação por voz",
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
    subtitle: "Mais tarefas por mês, recorrência ilimitada e criação por voz.",
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
