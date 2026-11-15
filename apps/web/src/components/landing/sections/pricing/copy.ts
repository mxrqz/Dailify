export const copy = {
  title: "Preço simples",
  subtitle: "Comece grátis. Mude de plano quando quiser.",
  billing: {
    label: "Cobrança",
    monthly: "Mensal",
    yearly: "Anual",
    yearlyHint: "2 meses grátis",
  },
  recommended: "Recomendado",
  per: { monthly: "/mês", yearly: "/ano" },
  // {price} = economia do anual contra 12× o mensal
  save: "Economize {price}",
  plans: {
    free: {
      name: "Free",
      desc: "Para organizar o dia sem pagar nada.",
      price: "Grátis",
      per: "para sempre",
      cta: "Começar grátis",
      features: [
        "Tarefas, recorrência e agenda ilimitadas",
        "30 créditos de IA por mês",
        "Integração com Google Agenda",
      ],
    },
    pro: {
      name: "Pro",
      desc: "A Mewki no dia a dia, conectada aos seus apps de trabalho.",
      cta: "Assinar Pro",
      features: [
        "Tudo do Free",
        "300 créditos de IA por mês",
        "Agenda, Notion, GitHub, Slack e envio pelo Gmail",
      ],
    },
    max: {
      name: "Max",
      desc: "Para quem resolve tudo falando com a Mewki.",
      cta: "Assinar Max",
      features: ["Tudo do Pro", "1.000 créditos de IA por mês", "Novas integrações primeiro"],
    },
  },
  // {credits} vira `noteCredits` em negrito
  note: "{credits} são usados em áudios, pedidos mais elaborados e ações nas integrações. Tarefas simples, como “comprar pão” ou “reunião toda segunda às 10h30”, não gastam crédito.",
  noteCredits: "Créditos de IA",
} as const;
