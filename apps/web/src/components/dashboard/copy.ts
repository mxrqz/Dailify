import type { ProviderId, QuotaKey, UnsureCode } from "@dailify/shared";

import type { ReminderOffset } from "@/functions/task-options";

/**
 * Dicionário de copy pt-BR do dashboard.
 *
 * Fonte única de verdade pra todo texto visível do app autenticado, espelhando o
 * `landing/copy.ts`. Estruturado plano (sem concatenação) pra permitir um locale `en` futuro
 * (bd Dailify-17s) — cada chave é uma string final pronta pra renderizar.
 *
 * Não hard-codar números de plano aqui: limites vêm de `@dailify/shared` `limitsFor`/`QUOTAS`.
 */
export const copy = {
  /** O `<title>` de cada página do app, no formato de `auth/copy.ts`. */
  pageTitle: {
    dashboard: "Mewki — Hoje",
    profile: "Mewki — Perfil",
    settings: "Mewki — Configurações",
    security: "Mewki — Segurança",
    integrations: "Mewki — Integrações",
  },

  header: {
    back: "Voltar",
    forward: "Avançar",
    upgrade: "Assinar",
    profile: "Perfil",
    openNav: "Abrir navegação",
    signIn: "Entrar",
    themeLight: "Claro",
    themeDark: "Escuro",
    themeSystem: "Sistema",
  },

  quota: {
    names: {
      ai: "Créditos de IA",
    } satisfies Record<QuotaKey, string>,
    summary: "{used} de {limit} {name}",
    /**
     * Sem teto a frase muda de forma, não só de palavra: "0 de ilimitado Tarefas" é agramatical, e
     * era o que a pilha anunciava justamente pra quem paga mais. Sem gênero no texto, que os
     * nomes de quota não compartilham.
     */
    summaryUnlimited: "{used} {name} · ilimitado",
    // A bandeja que sobe quando os créditos de IA acabam, em vez de levar pra outra página.
    trayTitle: "Seus créditos acabaram",
    trayBody:
      "Eles voltam na renovação do seu plano. Se quiser continuar com a Mew agora, os planos pagos têm mais créditos por mês.",
    trayUpgrade: "Ver planos",
    trayLater: "Agora não",
  },

  day: {
    today: "Hoje",
    tomorrow: "Amanhã",
    openCalendar: "Abrir calendário",
    createOn: "Criar tarefa em {day}",
    expandMonth: "Mostrar o mês",
    collapseMonth: "Mostrar só a semana",
    emptyDay: "Nada neste dia",
    zeroed: "Dia zerado",
    listEmpty: "Nada agendado pela frente.",
    listFirstRun: "Sua agenda começa aqui.",
    listFirstRunHint: "Escreva a tarefa do jeito que você falaria. O campo abaixo entende a data.",
    listFirstRunTry: "Experimente",
    listFirstRunExample: "dentista amanhã às 15h por 1h",
    // A Hoje e a agenda do redesign: hoje é "Agenda" (a página já se chama Hoje).
    agenda: "Agenda",
    week: "Semana",
    oneItem: "1 item",
    manyItems: "{n} itens",
    progress: "{done} de {total} tarefas de hoje concluídas",
    now: "Agora",
    nowAt: "Agora, {time}",
    until: "até {time}",
    // In place of the clock on each day of a task that crosses midnight.
    spanDay: "dia {k} de {n}",
    minutes: "{n} min",
    hours: "{h}h{m}",
    reminderOnTime: "Lembrete na hora",
    reminderBefore: "Lembrete {n} antes",
    meet: "Meet",
    noDate: "Sem data",
    withTasks: "{day}, com tarefas",
    more: "+{n} mais",
  },

  aside: {
    prevMonth: "Mês anterior",
    nextMonth: "Próximo mês",
    weekDayInitials: ["D", "S", "T", "Q", "Q", "S", "S"],
    weekDayShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  },

  sync: {
    offline: "Sem conexão",
    onePending: "1 pendente",
    manyPending: "{n} pendentes",
    dropped: "{n} alteração(ões) não foram aceitas pelo servidor",
  },

  errorBoundary: {
    title: "Algo deu errado",
    description: "Ocorreu um erro inesperado. Tente recarregar a página.",
    reload: "Recarregar",
  },

  loading: {
    /** Legenda do splash, só depois de 2s: antes disso a Mew caçando o laser já basta. */
    slow: "Buscando suas tarefas…",
    tasksError: "Não foi possível carregar suas tarefas",
  },

  form: {
    editTitle: "Tarefa",
    editDescription: "Edite e salve, ou conclua direto.",
    title: "Tarefa",
    titlePlaceholder: "O que precisa ser feito?",
    date: "Data",
    time: "Horário",
    hour: "Hora",
    minute: "Minuto",
    meridiem: "AM ou PM",
    undated: "Sem horário",
    undatedChip: "A qualquer hora",
    // Subtítulo da tarefa aberta: "Amanhã, 15:00 às 16:00".
    when: "{day}, {start} às {end}",
    reminder: "Lembrete",
    reminderValue: "{day} · {time}",
    noReminder: "Sem lembrete",
    // A dated task's reminder, as minutes before its start.
    reminderOffsets: {
      0: "Na hora",
      5: "5 min antes",
      10: "10 min antes",
      15: "15 min antes",
      30: "30 min antes",
      60: "1 h antes",
      1440: "1 dia antes",
    } satisfies Record<ReminderOffset, string>,
    duration: "Duração",
    links: "Links",
    linkOpen: "Abrir link",
    linkRemove: "Remover link",
    linkPlaceholder: "cole a URL",
    linkInvalid: "URL inválida",
    meet: "Google Meet",
    meetPlaceholder: "meet.google.com/abc-defg-hij",
    meetInvalid: "Cole um link de sala do Meet",
    // A troca vai pra Agenda: quem entrar pelo evento cai na sala nova.
    meetHint: "A Agenda acompanha: o evento passa a usar esta sala.",
    meetNew: "Gerar novo Meet",
    meetRemove: "Remover Meet",
    meetReplaced: "Novo Meet na Agenda",
    meetError: "Não foi possível gerar o Meet",
    priority: "Prioridade",
    tags: "Tags",
    tagRemove: "Tirar a tag {tag}",
    // As tags além das duas que a linha mostra.
    moreTags: "+{n}",
    repeat: "Repetição",
    repeatOff: "Não repetir",
    repeatDaily: "Diária",
    repeatWeekly: "Semanal",
    repeatWeeklyDays: "Semanal · {days}",
    repeatMonthly: "Mensal",
    repeatYearly: "Anual",
    repeatEvery: "Intervalo",
    repeatEveryOther: "Dia sim, dia não",
    // "{n}" = `repeatEvery`, na unidade do `Repeat`.
    repeatEveryUnit: {
      Daily: "A cada {n} dias",
      Weekly: "A cada {n} semanas",
      Monthly: "A cada {n} meses",
      Yearly: "A cada {n} anos",
    },
    // Ordem de `weekDays` do shared (domingo primeiro) — o índice vem do `dayMap`.
    repeatDays: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
    back: "Voltar",
    tagSearch: "buscar ou criar tag",
    cancel: "Cancelar",
    save: "Salvar",
    titleRequired: "O título é obrigatório",
    created: "Tarefa criada",
    createdUndated: "Anotado para qualquer hora",
    updated: "Tarefa atualizada",
    noChanges: "Nenhuma alteração para salvar",
    createError: "Não foi possível salvar a tarefa",
    authError: "Sua sessão expirou. Entre novamente.",
    scopeTitle: "Esta tarefa se repete",
    scopeDescription: "O que você quer alterar?",
    scopeOccurrence: "Só esta ocorrência",
    scopeSeries: "Todas as ocorrências",
    scopeDetached: "Ocorrência atualizada",
    scopeDeleteDescription: "O que você quer excluir?",
    notificationsOff: "Receba um lembrete na hora do alerta da tarefa.",
    notificationsUnsupported: "Este navegador não suporta notificações.",
    notificationsDenied:
      "As notificações estão bloqueadas para a Mewki. Libere nas permissões do navegador.",
    notificationsError: "Não foi possível ativar as notificações",
    notificationsDeniedApp:
      "As notificações estão bloqueadas para a Mewki. Libere nas configurações do Android.",
    exactAlarmTitle: "Avisar na hora certa",
    exactAlarmHint: "Permita “Alarmes e lembretes” para o lembrete não chegar atrasado.",
    batteryTitle: "Não pausar os lembretes",
    batteryHint:
      "Neste celular a economia de bateria pode segurar os lembretes. Tire a Mewki dela.",
  },

  profile: {
    pageTitle: "Perfil",
    settingsPageTitle: "Configurações",
    securityPageTitle: "Segurança",
    navLabel: "Navegação",
    navDashboard: "Hoje",
    navPersonal: "Perfil",
    navSecurity: "Segurança",
    navPremium: "Planos",
    navSettings: "Configurações",
    navCalendar: "Calendário",
    navMew: "Conversar com a Mew",
    navIntegrations: "Integrações",
    navAccount: "Conta",
    // The desktop sidebar's account button; the menu holds Perfil, Segurança and Sair.
    accountMenu: "Conta de {name}: perfil, segurança e sair",
    upgradePro: "Assinar Pro",
    planLabel: "Plano",
    planName: "Plano {plan}",
    creditsSummary: "{used} de {limit} créditos de IA este mês",
    editTitle: "Editar perfil",
    editDescription: "Atualize suas informações e salve quando terminar.",
    themeTitle: "Tema",
    weekStartTitle: "Primeiro dia da semana",
    weekStartDescription: "Define o início do calendário e quando as tarefas semanais zeram.",
    weekStartError: "Não foi possível salvar o primeiro dia da semana",
    groupAppearance: "Aparência",
    groupDateTime: "Data e hora",
    groupData: "Dados",
    groupAccount: "Conta",
    groupSessions: "Sessões ativas",
    securityLead: "Os aparelhos com a sua conta aberta.",
    sessionsFooter: "Encerrar tira a sua conta daquele aparelho.",
    pushTitle: "Lembretes neste aparelho",
    groupAssistant: "Assistente",
    assistantTitle: "Assistente do celular",
    assistantFooter:
      "Segure o botão de ligar pra falar com a Mew. Pra voltar ao assistente de antes, toque aqui e escolha outro app.",
    groupHelp: "Ajuda",
    replayIntro: "Rever introdução",
    timeZoneTitle: "Fuso horário",
    timeZoneAuto: "Automático · {zone}",
    timeZoneSearch: "Buscar cidade ou GMT",
    timeZoneEmpty: "Nenhum fuso encontrado",
    timeZoneError: "Não foi possível salvar o fuso horário",
    hourFormatTitle: "Formato de hora",
    hour24: "24h",
    hour12: "12h",
    hourFormatError: "Não foi possível salvar o formato de hora",
    signOut: "Sair",
    notificationsTitle: "Notificações",
    emailLocked: "O e-mail não pode ser alterado.",
    name: "Nome",
    email: "E-mail",
    empty: "Adicionar",
    nameError: "Não foi possível salvar o nome",
    saving: "Salvando",
    revokeDevice: "Encerrar",
    thisDevice: "Este aparelho",
    unknownDevice: "Aparelho desconhecido",
    revokeOthers: "Encerrar as outras sessões",
    sessionMeta: "{place} · {when}",
    sessionsError: "Não foi possível carregar as sessões",
    revokeError: "Não foi possível encerrar a sessão",
    dangerDescription:
      "Encerra sua conta, apaga suas tarefas e cancela a assinatura. Não há como desfazer.",
    deleteAccount: "Excluir conta",
    deleteConfirmTitle: "Excluir sua conta?",
    deleteConfirmDescription:
      "Suas tarefas são apagadas, a assinatura é cancelada e a conta deixa de existir. Isto não pode ser desfeito.",
    deleteConfirmPrompt: "Digite {email} para confirmar",
    deleteConfirmCta: "Excluir permanentemente",
    deleteAccountError: "Não foi possível excluir a conta",
  },

  integrations: {
    group: "Integrações",
    lead: "A Mewki age nos seus apps só com o seu ok.",
    back: "Configurações",
    all: "Todas as integrações",
    groupConnected: "Conectado",
    groupAvailable: "Disponível",
    connectedState: "Conectado",
    // Por provedor: artigo e gênero mudam ("Agenda conectada", "Slack conectado").
    apps: {
      "google-calendar": {
        name: "Agenda",
        does: ["Cria eventos das tarefas que você mandar", "Atualiza o evento se a tarefa mudar"],
        connected: "Agenda conectada",
        disconnected: "Agenda desconectada",
        denied: "Conexão com a Agenda cancelada",
        missingScope: "Faltou permissão: marque a permissão da Agenda na tela do Google",
        disconnectDescription:
          "Suas tarefas continuam na Mewki, só param de sincronizar com a Agenda. Você pode conectar de novo quando quiser.",
      },
      slack: {
        name: "Slack",
        does: ["A Mew lê conversas quando você pedir", "Manda as mensagens que você confirmar"],
        connected: "Slack conectado",
        disconnected: "Slack desconectado",
        denied: "Conexão com o Slack cancelada",
        missingScope: "Faltou permissão: aceite todos os acessos na tela do Slack",
        disconnectDescription:
          "A Mew deixa de ler e mandar mensagens no Slack. Você pode conectar de novo quando quiser.",
      },
    } satisfies Record<
      ProviderId,
      {
        name: string;
        does: string[];
        connected: string;
        disconnected: string;
        denied: string;
        missingScope: string;
        disconnectDescription: string;
      }
    >,
    calendarDefault: "Novas tarefas na Agenda",
    calendarDefaultHint: "Padrão da etiqueta Agenda ao criar",
    always: "Sempre",
    never: "Nunca",
    upcoming: {
      gmail: { name: "Gmail", hint: "Envia e-mails que você confirmar" },
      notion: { name: "Notion", hint: "Lembra prazos das suas páginas" },
      github: { name: "GitHub", hint: "Reviews e issues viram tarefas" },
    },
    connect: "Conectar",
    reconnect: "Reconectar",
    disconnect: "Desconectar",
    soon: "Em breve",
    pro: "Pro",
    lockedHint: "Disponível no plano Pro",
    revokedHint: "O acesso foi revogado. Reconecte para voltar a usar.",
    offlineHint: "Sem conexão",
    disconnectTitle: "Desconectar {name}?",
    connecting: "Conectando {name}…",
    connectError: "Não foi possível conectar {name}",
    disconnectError: "Não foi possível desconectar {name}",
    wrongUser: "Este pedido de conexão é de outra conta",
    failed: "Não deu pra concluir a conexão; tente de novo",
    // "Sempre permitir" na caixa da Mew; desligar faz ela pedir de novo.
    readAlways: "A Mew lê sem perguntar",
    readAlwaysHint: "Desligue pra ela pedir antes de ler",
    readAlwaysError: "Não foi possível desligar",
  },

  calendar: {
    // O nome da integração, sozinho, em todo lugar (linhas, chips, meta, /integrations); o logo ao lado
    // diz que é o Google. No locale `en` (bd Dailify-17s) é "Calendar", sem o "Google".
    name: "Agenda",
    add: "Adicionar à Agenda",
    linked: "Na Agenda",
    meet: "Criar link do Meet",
    added: "Evento criado na Agenda",
    open: "Abrir",
    alreadyLinked: "Esta tarefa já está na Agenda",
    revoked: "O acesso à Agenda foi revogado",
    reconnect: "Reconectar",
    error: "Não foi possível criar o evento",
    unsynced: "não sincronizado",
    retry: "Sincronizar com a Agenda",
    synced: "Agenda sincronizada",
    syncError: "Não foi possível sincronizar com a Agenda",
    // A etiqueta do composer (`name`): ligada, a tarefa nasce e vai pra Agenda — ligar já é confirmar.
    chipLabel: "Enviar à Agenda",
    meetChip: "+ Meet",
    meetOn: "Com Meet",
    mewPicked: "A Mew marcou: você pediu pra pôr na Agenda",
    createdAdded: "Tarefa criada e na Agenda",
    createdAddedMany: "{n} tarefas criadas e na Agenda",
    notAdded: "Tarefa criada, mas não foi pra Agenda",
    notAddedMany: "{n} tarefas não foram pra Agenda",
    tryAgain: "Tentar de novo",
    // Convite de outra pessoa (readonly): a agenda é de quem convidou.
    readonly: "Só quem convidou pode mudar",
    // Excluir uma tarefa ligada à Agenda apaga o evento lá também, sem desfazer.
    deleteTitle: "Excluir “{title}” da Mewki e da Agenda?",
    deleteSeries: "A série inteira some das duas agendas.",
    deleteConfirm: "Excluir",
    // As duplicatas da importação: o evento da Agenda parece uma tarefa que você já tinha.
    duplicateTitle: "Encontramos uma duplicata",
    duplicatesTitle: "Encontramos {n} duplicatas",
    duplicateHint: "Juntar mantém a sua tarefa, agora ligada à Agenda.",
    mewki: "Mewki",
    noDate: "Sem data",
    merge: "Juntar",
    keep: "Manter as duas",
    merged: "Tarefas juntadas",
    resolveError: "Não foi possível resolver a duplicata",
    // O que a Mewki não sabe representar (recorrência exótica, dia todo repetido) fica lá.
    skippedOne: "1 evento ficou só na Agenda",
    skippedMany: "{n} eventos ficaram só na Agenda",
  },

  composer: {
    text: "Tarefa",
    textPlaceholder: "Reunião com o time hoje às 16:30",
    submit: "Criar tarefa",
    open: "Nova tarefa",
    addDay: "+ dia",
    addTime: "+ horário",
    addDuration: "+ duração",
    addReminder: "+ lembrete",
    // Chips: tocar edita o valor, o × devolve as palavras ao título.
    editDay: "Editar dia: {value}",
    editTime: "Editar horário: {value}",
    editDuration: "Editar duração: {value}",
    editRepeat: "Editar repetição: {value}",
    editLinks: "Editar link: {value}",
    editReminder: "Editar lembrete: {value}",
    removeDay: "Tirar o dia",
    removeTime: "Tirar o horário",
    removeDuration: "Tirar a duração",
    removeRepeat: "Tirar a repetição",
    removeLinks: "Tirar o link",
    // "Vai para Agenda | A qualquer hora | A qualquer hora · Recorrentes", antes de enviar.
    goesTo: "Vai para",
    toAgenda: "Agenda",
    toUndated: "A qualquer hora",
    toRecurring: "A qualquer hora · Recorrentes",
    hintCreate: "⏎ criar",
    hintContinue: "criar e continuar",
    understood: "O que a Mewki entendeu",
    // O dock do mobile: abre a folha de criação, ou já gravando pelo mic.
    dock: "Ei Mewki, anota…",
    dockVoice: "Falar com a Mewki",
    reminderAt: "Lembrete {value}",
    // O `{value}` do `reminderAt`: "Ter 09:00".
    alertAt: "{day} {time}",
  },

  // The desktop side panel (an open task, the Mew or a calendar day) and its toolbar toggle.
  panel: {
    open: "Abrir painel",
    close: "Fechar painel",
    task: "Tarefa",
    mew: "Mew",
    createOnDay: "Nova tarefa nesse dia",
    openInToday: "Abrir na Hoje",
  },

  // Tarefas sem data: o bloco "A qualquer hora" no topo de hoje.
  undated: {
    title: "A qualquer hora",
    onePending: "1 pendente",
    manyPending: "{n} pendentes",
    capture: "Anotar uma coisa…",
    doneDaily: "feito hoje",
    doneWeekly: "feito nesta semana",
    doneMonthly: "feito neste mês",
    doneYearly: "feito neste ano",
    reminder: "Lembrete",
    history: "Feito em {done} de {total} {unit}",
    unitDaily: "dias",
    unitWeekly: "semanas",
    unitMonthly: "meses",
    unitYearly: "anos",
    // Arrastar uma linha pra um dia (desktop): a roda de horário que abre ao soltar.
    scheduleTitle: "Horário em {day}",
    schedule: "Agendar",
  },

  voice: {
    record: "Criar por voz",
    stop: "Parar e criar",
    sending: "Criando pela voz",
    understanding: "Entendendo…",
    listening: "Ouvindo…",
    cancel: "Cancelar gravação",
    wave: "Microfone captando",
    hint: "Fale a tarefa e quando ela acontece.",
    timerOf: "de {max}",
    maxLength: "Gravação encerrada no limite de 60 segundos.",
    createdOne: "Tarefa criada pela voz",
    createdMany: "{n} tarefas criadas pela voz",
    nothing: "Não entendi nenhuma tarefa nessa fala",
    error: "Não foi possível criar pela voz",
    micDenied: "Sem acesso ao microfone",
    micDeniedHint: "Libere o microfone nas permissões do navegador.",
  },

  // "Melhorar com a Mew": a leitura por IA do texto do composer, sempre a pedido (1 crédito).
  mew: {
    improve: "Melhorar com a Mew · 1 crédito",
    pending: "A Mew está lendo…",
    remainingOne: "1 restante",
    remainingMany: "{n} restantes",
    exhausted: "Créditos de IA esgotados",
    upgrade: "Assinar",
    upgradeLabel: "Créditos de IA esgotados · Assinar",
    failed: "A Mew não conseguiu agora",
    noCredit: "Nenhum crédito foi usado.",
    draft: "Lido pela Mew",
    drafts: "Tarefas lidas pela Mew",
    confirmMany: "Criar {n} tarefas",
    found: "Achei {n} tarefas nessa frase. Confere antes de eu criar?",
    credits: "Créditos de IA · {left}",
    createdMany: "{n} tarefas criadas",
    // Por que o parser local pode ter errado — o motivo que aparece junto do botão.
    unsure: {
      question: "Parece uma pergunta",
      command: "Parece um pedido sobre a agenda",
      multi: "Tem mais de uma tarefa",
      "list-values": "Tem uma lista no meio",
      "repeat-unsupported": "Não entendi a repetição",
      alert: "Não entendi o lembrete",
      vague: "O quando ficou vago",
      "ambiguous-number": "Um número pode não ser hora",
      "ambiguous-word": "Uma palavra pode não ser data",
      leftover: "Sobrou data ou hora no título",
      dangling: "A frase ficou pela metade",
      past: "A data caiu no passado",
      long: "Frase longa",
      integration: "Pede pra pôr num app conectado",
    } satisfies Record<UnsureCode, string>,
  },

  task: {
    complete: "Concluir",
    delete: "Excluir",
    completed: "Concluída",
    completeError: "Não foi possível concluir a tarefa",
    uncomplete: "Reabrir",
    uncompleteError: "Não foi possível reabrir a tarefa",
    patchError: "Não foi possível salvar a alteração",
    editTime: "Mudar horário de {title}",
    editDay: "Mudar o dia de {title}",
    more: "Mais ações para {title}",
    open: "Abrir",
    deleteError: "Não foi possível excluir a tarefa",
    occurrenceDeleted: "Ocorrência excluída",
    deleted: "Tarefa excluída",
    undo: "Desfazer",
    undoError: "Não foi possível restaurar a tarefa",
    restored: "Tarefa restaurada",
    saving: "Salvando…",
    queued: "Sem conexão — guardado pra sincronizar depois",
  },

  /** A moldura de `/privacidade` e `/termos`; o texto legal em si fica nas páginas, como foi revisado. */
  legal: {
    back: "Voltar",
    toc: "Nesta página",
    questions: "Dúvidas?",
    home: "Voltar ao início",
    updated: "Última atualização: 17 de novembro de 2026",
    privacy: {
      pageTitle: "Mewki — Política de Privacidade",
      title: "Política de Privacidade",
      bar: "Privacidade",
      contact: "Fale com a gente sobre seus dados e direitos pela LGPD.",
    },
    terms: {
      pageTitle: "Mewki — Termos de Uso",
      title: "Termos de Uso",
      bar: "Termos",
      contact: "Fale com a gente sobre sua conta, plano ou estes Termos.",
    },
  },
} as const;

export type DashboardCopy = typeof copy;
