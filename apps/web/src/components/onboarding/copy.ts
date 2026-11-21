import type { OnboardingStep } from "./steps";

/** A introdução da primeira abertura (`onboarding.tsx`). */
export const copy = {
  label: "Introdução à Mewki",
  progress: "Passo {step} de {total}",
  skip: "Pular",
  next: "Continuar",
  back: "Voltar",
  notNow: "Agora não",
  steps: {
    welcome: {
      title: "Seu dia, no lugar.",
      body: "Eu anoto suas tarefas, te lembro na hora certa e organizo a semana com você. Leva menos de um minuto pra conhecer.",
    },
    create: {
      title: "Escreva ou fale do seu jeito",
      body: "Eu entendo o dia, o horário e a repetição na hora. Toque no microfone pra falar.",
    },
    mew: {
      title: "Peça e eu organizo",
      body: "Nada sai sem o seu ok: eu mostro o que vou fazer e você confirma. Toque em mim no fim da agenda pra conversar.",
    },
    notifications: {
      title: "Lembretes na hora certa",
      body: "Eu te aviso antes de cada tarefa. Você escolhe quanto antes em cada uma, e pode desligar nas Configurações.",
    },
    assistant: {
      title: "Fale comigo de qualquer lugar",
      body: "Me deixe como assistente do celular. Dá pra voltar pro assistente de antes quando quiser, em Configurações › Assistente.",
    },
    done: {
      title: "Que tal a primeira tarefa?",
      body: "Experimente uma destas, ou escreva a sua.",
    },
  } satisfies Record<OnboardingStep, { title: string; body: string }>,
  createBodyDesktop:
    "Eu entendo o dia, o horário e a repetição na hora. Aperte N pra uma tarefa nova, ou / pra falar comigo.",
  start: "Começar",
  hello: "Oi! Eu sou a Mew.",
  ready: "Tudo pronto!",
  finish: "Ir pra agenda",
  enableNotifications: "Ativar notificações",
  useAssistant: "Usar a Mew como assistente",
  assistantHint: "Abre o Android: escolha Mewki em App assistente digital.",
  suggestions: ["Ligar pro dentista amanhã às 9", "Academia toda seg e qua às 7"],
  demo: {
    sentence: { title: "Dentista", day: "amanhã", time: "às 9" },
    dayChip: "Amanhã",
    clock: "09:00",
    rowMeta: "Amanhã · 30 min",
    ask: "Tira tudo de sexta, vou viajar",
    reply: "Achei 3 tarefas na sexta. Passo pra segunda?",
    rows: [
      { time: "09:00", title: "Reunião de time" },
      { time: "14:00", title: "Escrever proposta" },
      { time: "18:30", title: "Academia" },
    ],
    move: "Mover 3",
    change: "Mudar algo",
    app: "Mewki",
    now: "agora",
    reminder: "Dentista em 15 min",
    reminderMeta: "09:00 · Rua das Flores, 120",
    morningAt: "08:00",
    morning: "Hoje: 4 tarefas",
    holdPower: "Segure o botão de ligar",
    listening: "Eu abro já ouvindo: é só falar",
  },
} as const;
