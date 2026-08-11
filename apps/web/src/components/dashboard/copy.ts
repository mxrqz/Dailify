/**
 * Dicionário de copy pt-BR do dashboard.
 *
 * Fonte única de verdade pra todo texto visível do app autenticado, espelhando o
 * `landing/copy.ts`. Estruturado plano (sem concatenação) pra permitir um locale `en` futuro
 * (bd Dailify-17s) — cada chave é uma string final pronta pra renderizar.
 *
 * Não hard-codar números de plano aqui: limites vêm de `@dailify/shared` `PLAN_PERMISSIONS`.
 */
export const copy = {
  header: {
    logoAlt: "Dailify",
    viewDay: "Hoje",
    viewMonth: "Mês",
    upgrade: "Assinar",
    profile: "Perfil",
    accountMenu: "Menu da conta",
    settings: "Configurações",
    signOut: "Sair",
    signIn: "Entrar",
    dashboard: "Dashboard",
  },

  day: {
    today: "Hoje",
    now: "agora",
    emptyTitle: "SEM TAREFAS PARA ESTE DIA",
    emptyHint: "Crie a primeira e ela aparece aqui, encaixada no horário.",
    newTask: "Nova tarefa",
    voiceTask: "Criar por voz",
  },

  aside: {
    nextTaskLabel: "PRÓXIMA TAREFA",
    noNextTask: "Nada pela frente neste mês.",
    calendarLabel: "CALENDÁRIO",
    prevMonth: "Mês anterior",
    nextMonth: "Próximo mês",
  },

  task: {
    complete: "Concluir",
    edit: "Editar",
    delete: "Excluir",
    options: "Opções da tarefa",
    completed: "Concluída",
    completeError: "Não foi possível concluir a tarefa",
    deleteError: "Não foi possível excluir a tarefa",
  },
} as const;

export type DashboardCopy = typeof copy;
