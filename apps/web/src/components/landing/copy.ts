/**
 * Dicionário de copy pt-BR da landing page.
 *
 * Fonte única de verdade pra todo texto visível na landing (T4–T10 consomem `copy.<seção>`).
 * Estruturado plano (sem concatenação) pra permitir um locale `en` futuro (bd Dailify-1xy) — cada
 * chave é uma string final pronta pra renderizar.
 *
 * Não hard-codar números de plano aqui: limites vêm de `@dailify/shared` `PLAN_PERMISSIONS` e
 * preços do Stripe, resolvidos onde a pricing section é montada.
 */
export const copy = {
  nav: {
    logoAlt: "Dailify",
    features: "Features",
    pricing: "Preços",
    signIn: "Entrar",
    getStarted: "Começar",
  },

  hero: {
    eyebrow: "// ORGANIZE SEU DIA",
    titleLead: "O seu dia,",
    titleAccent: "projetado",
    titleTail: "não improvisado.",
    subtitle:
      "Tarefas, horários e recorrência num só lugar — o Dailify monta seu dia pra você só executar.",
    ctaPrimary: "Começar — é grátis",
    ctaSecondary: "Ver como funciona",
    commandHint: "sem cartão de crédito",
  },

  features: {
    tabs: {
      day: {
        label: "DAY",
        title: "Seu dia, numa coluna",
        blurb: "Tarefas encaixadas no horário certo, com a linha do agora sempre visível.",
      },
      calendar: {
        label: "CALENDÁRIO",
        title: "O mês inteiro, num relance",
        blurb: "Veja onde seus dias estão cheios e onde estão livres antes de comprometer nada.",
      },
      recurrence: {
        label: "RECORRÊNCIA",
        title: "Configura uma vez, roda sozinho",
        blurb: "Diário, semanal ou mensal — a rotina se repete sem você precisar recriar nada.",
      },
      voice: {
        label: "VOZ",
        title: "Fala. Virou tarefa.",
        blurb: "Descreve em voz alta e o Dailify estrutura horário, duração e prioridade pra você.",
      },
    },
  },

  bento: {
    calendar: {
      title: "Calendário",
      description: "Sua vida num relance — hoje sempre em destaque.",
    },
    timeSlots: {
      title: "Tarefas por horário",
      description: "O dia como uma linha do tempo cronometrada, hora a hora.",
    },
    priority: {
      title: "Prioridade",
      description: "O que importa mais sobe pro topo automaticamente.",
    },
    recurrence: {
      title: "Recorrência",
      description: "Tarefas que voltam sozinhas, no seu ritmo.",
    },
    voice: {
      title: "Voz (Pro+AI)",
      description: "Você fala, a IA transforma em tarefa estruturada.",
    },
    reminders: {
      title: "Lembretes",
      description: "Um toque na hora certa, nunca antes nem depois.",
    },
  },

  howItWorks: {
    steps: [
      {
        step: "01",
        title: "Crie suas tarefas",
        description:
          "Adicione horário, duração e prioridade. Marque como única ou recorrente em segundos.",
      },
      {
        step: "02",
        title: "Deixe o Dailify organizar",
        description: "Veja tudo encaixado na sua coluna do dia ou no calendário do mês.",
      },
      {
        step: "03",
        title: "Execute e siga em frente",
        description: "Marque como concluído, receba lembretes e mantenha o ritmo sem esforço.",
      },
    ],
  },

  pricing: {
    tagline: "Preço simples, sem letra miúda",
    plans: {
      free: {
        name: "Free",
        description: "Pra começar a organizar seu dia sem pagar nada.",
        cta: "Começar grátis",
      },
      pro: {
        name: "Pro",
        description: "Tarefas ilimitadas e recorrência pra quem já vive no Dailify.",
        cta: "Assinar Pro",
      },
      proAi: {
        name: "Pro+AI",
        description: "Tudo do Pro, mais criação de tarefa por voz.",
        cta: "Assinar Pro+AI",
      },
    },
    recommendedBadge: "Recomendado",
  },

  cta: {
    title: "Pronto pra projetar seu dia?",
    subtitle: "Leva menos de um minuto pra criar sua conta e organizar sua primeira tarefa.",
    button: "Começar — é grátis",
  },

  footer: {
    logoAlt: "Dailify",
    tagline: "O seu dia, projetado.",
    columns: {
      product: {
        title: "Produto",
        features: "Features",
        pricing: "Preços",
      },
      legal: {
        title: "Legal",
        privacy: "Privacidade",
        terms: "Termos",
      },
    },
    status: "DAILIFY // 2026 · feito no Brasil",
    copyright: "© 2026 Dailify. Todos os direitos reservados.",
  },
} as const;

export type LandingCopy = typeof copy;
