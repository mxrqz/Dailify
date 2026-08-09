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
    features: "Recursos",
    pricing: "Preços",
    signIn: "Entrar",
    getStarted: "Começar",
  },

  hero: {
    eyebrow: "// ORGANIZE SEU DIA",
    title: "Planeje seu dia",
    // Partes do subtítulo; as marcadas `cycle` recebem o accent em rodízio (mesmo trigger).
    subtitle: [
      { text: "Suas ", cycle: false },
      { text: "tarefas", cycle: true },
      { text: ", ", cycle: false },
      { text: "horários", cycle: true },
      { text: " e ", cycle: false },
      { text: "recorrência", cycle: true },
      {
        text: ", tudo num só lugar. O Dailify monta o seu dia pra você só executar.",
        cycle: false,
      },
    ],
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
    duracao: {
      title: "Duração",
      description: "Cada tarefa ocupa um bloco real de tempo — dá pra ver o dia caber.",
    },
    comeceGratis: {
      title: "Comece grátis",
      description: "Organize seu dia sem pagar nada e sem cartão de crédito.",
    },
    priority: {
      title: "Prioridade",
      description: "O que importa mais sobe pro topo automaticamente.",
    },
    concluido: {
      title: "Concluído",
      description: "Marque com um toque e veja o dia avançar.",
    },
    navegador: {
      title: "No navegador",
      description: "Abre em qualquer device, nada pra instalar.",
    },
    reminders: {
      title: "Lembretes",
      description: "Um toque na hora certa, nunca antes nem depois.",
    },
  },

  howItWorks: {
    eyebrow: "// COMO FUNCIONA",
    title: "Do jeito mais simples possível",
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
    eyebrow: "// PREÇOS",
    title: "Preço simples, sem letra miúda",
    billing: {
      monthly: "Mensal",
      yearly: "Anual",
      save: "2 meses grátis",
      perMonth: "/mês",
      perYear: "/ano",
    },
    freePrice: "Grátis",
    freeNote: "pra sempre",
    plans: {
      free: {
        name: "Free",
        description: "Pra começar a organizar seu dia sem pagar nada.",
        cta: "Começar grátis",
      },
      pro: {
        name: "Pro",
        description: "Mais tarefas por mês e recorrência ilimitada pra quem já vive no Dailify.",
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
    // Cada item é um trecho indivisível (renderizado em whitespace-nowrap): a quebra de linha só
    // acontece ENTRE trechos, e só quando não cabe em 1 linha. Editar aqui = mudar onde a quebra cai.
    // Título: quebra (se houver) obrigatoriamente antes de "seu dia".
    title: ["Comece a organizar", "seu dia hoje"],
    subtitle: ["Leva menos de um minuto pra criar sua conta", "e organizar sua primeira tarefa."],
    button: "Começar — é grátis",
  },

  footer: {
    logoAlt: "Dailify",
    tagline: "O seu dia, projetado.",
    columns: {
      product: {
        title: "Produto",
        features: "Recursos",
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
