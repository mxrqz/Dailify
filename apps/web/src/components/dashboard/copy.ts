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
    back: "Voltar",
    forward: "Avançar",
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
    tomorrow: "Amanhã",
    now: "agora",
    noTasks: "Nenhuma tarefa",
    oneTask: "1 tarefa",
    manyTasks: "{n} tarefas",
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
    repeatOff: "Não repetir",
    repeatDaily: "Diária",
    repeatWeekly: "Semanal",
    repeatMonthly: "Mensal",
    repeatYearly: "Anual",
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

  profile: {
    pageTitle: "Perfil",
    back: "Voltar",
    navLabel: "Navegação",
    navDashboard: "Tarefas",
    navPersonal: "Perfil",
    navSecurity: "Segurança",
    navPremium: "Premium",
    navSettings: "Configurações",
    personalTitle: "Informações pessoais",
    personalDescription: "Gerencie seus dados e como eles aparecem.",
    editProfile: "Editar perfil",
    editTitle: "Editar perfil",
    editDescription: "Atualize suas informações e salve quando terminar.",
    notificationsTitle: "Notificações",
    notificationsDescription: "Escolha como você quer ser avisado sobre suas tarefas.",
    notificationsSoon: "As opções de notificação chegam em breve.",
    emailLocked: "O e-mail não pode ser alterado.",
    saving: "Salvando",
    addPhone: "Adicionar telefone",
    revokeDevice: "Encerrar sessão",
  },

  composer: {
    when: "Quando",
    whenPlaceholder: "Hoje às 14 horas",
    text: "Tarefa",
    textPlaceholder: "o que precisa ser feito?",
    submit: "Criar tarefa",
  },

  voice: {
    title: "Criar tarefa por voz",
    description:
      "Grave sua voz dizendo o título, a data, o horário e os outros detalhes da tarefa.",
    record: "Gravar",
    stop: "Parar gravação",
    send: "Criar tarefa",
    sending: "Criando tarefa",
  },

  task: {
    complete: "Concluir",
    edit: "Editar",
    delete: "Excluir",
    options: "Opções da tarefa",
    completed: "Concluída",
    noDescription: "Sem descrição.",
    completeError: "Não foi possível concluir a tarefa",
    deleteError: "Não foi possível excluir a tarefa",
  },
} as const;

export type DashboardCopy = typeof copy;
