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
    prevMonth: "Mês anterior",
    nextMonth: "Próximo mês",
    weekDayInitials: ["D", "S", "T", "Q", "Q", "S", "S"],
  },

  month: {
    today: "Hoje",
    prevMonth: "Mês anterior",
    nextMonth: "Próximo mês",
    moreTasks: "+{n}",
    sheetTitle: "Tarefas do dia",
    sheetEmpty: "Nenhuma tarefa neste dia.",
    dayLabelFormat: "d 'de' MMMM",
  },

  loading: {
    tasks: "Carregando tarefas",
    tasksError: "Não foi possível carregar suas tarefas",
  },

  form: {
    newTitle: "Nova tarefa",
    newDescription: "Descreva o que precisa ser feito e quando.",
    editTitle: "Editar tarefa",
    editDescription: "Ajuste os detalhes e salve.",
    title: "Título",
    titlePlaceholder: "O que precisa ser feito?",
    description: "Descrição",
    descriptionPlaceholder: "Detalhes da tarefa",
    date: "Data",
    duration: "Duração",
    priority: "Prioridade",
    tags: "Tags",
    repeat: "Repetição",
    cancel: "Cancelar",
    save: "Salvar",
    create: "Criar tarefa",
    titleRequired: "O título é obrigatório",
    descriptionRequired: "A descrição é obrigatória",
    fieldsRequired: "Preencha todos os campos",
    created: "Tarefa criada",
    updated: "Tarefa atualizada",
    noChanges: "Nenhuma alteração para salvar",
    createError: "Não foi possível salvar a tarefa",
    authError: "Sua sessão expirou. Entre novamente.",
    limitReached: "Limite de tarefas atingido",
    limitReachedHint: "Você atingiu o limite do seu plano neste mês.",
    upgrade: "Assinar",
  },

  task: {
    complete: "Concluir",
    delete: "Excluir",
    options: "Opções da tarefa",
    completed: "Concluída",
    completeError: "Não foi possível concluir a tarefa",
    deleteError: "Não foi possível excluir a tarefa",
  },
} as const;

export type DashboardCopy = typeof copy;
