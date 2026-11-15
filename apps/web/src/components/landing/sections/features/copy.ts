// Textos da seção de features (pt-BR). Cada string é final, sem concatenação (bd Dailify-1xy):
// um locale `en` é só outro objeto com o mesmo formato.
export const copy = {
  title: "Uma assistente que cuida de tudo",

  talk: {
    title: "Fala do seu jeito",
    desc: "Por texto ou áudio, do jeito que você falaria com alguém. Ela entende e pergunta só o que faltou.",
    ask: "Ei Mewki, anota o show de sexta",
    placeholder: "Mensagem para a Mewki",
    voiceLength: "0:04",
    transcript: "“Show do Bayside sexta às 19h”",
    question: "Anotado! Show na sexta às 19h. Quando eu te aviso?",
    // digitado palavra por palavra no input, depois vira a bolha do usuário
    reply: "30 min antes",
    eventKind: "Evento",
    eventTitle: "Show do Bayside",
    eventWhen: "Sex, 20 nov · 19:00–22:00",
    eventAlert: "Te aviso às 18:30",
  },

  repeat: {
    title: "Repete sem você lembrar",
    desc: "Toda segunda, dia sim dia não, todo dia 10. Fala uma vez e ela espalha pelo calendário.",
    ask: "Ei Mewki, reunião toda segunda",
    chip: "Toda segunda · 9h",
    weekdays: ["S", "T", "Q", "Q", "S", "S", "D"],
  },

  remind: {
    title: "Te chama na hora certa",
    desc: "Um toque antes de cada compromisso, com o que você precisa saber.",
    ask: "Ei Mewki, me avisa 15 min antes",
    app: "Mewki",
    when: "agora",
    body: "Dentista em 15 min · Rua Augusta, 120",
  },

  ok: {
    title: "Nada sai sem o seu ok",
    desc: "Para mandar mensagem, criar issue ou responder e-mail, a Mewki monta o rascunho e espera você confirmar. Fora do app, ela nunca age sozinha.",
    ask: "Ei Mewki, responde a Ana no Slack",
    change: "Mudar algo",
    // `icon` escolhe o ícone genérico do app em ok-art.tsx
    scenarios: [
      {
        icon: "chat",
        source: "Slack · #financeiro",
        ask: "Responde a Ana no Slack que o orçamento sai quinta",
        status: "Conectando ao Slack",
        title: "Resposta para a Ana",
        to: "Para: Ana Souza",
        body: "Oi Ana! O orçamento sai até quinta, 18h. Te mando assim que fechar.",
        cta: "Enviar",
        done: "Enviado no Slack",
      },
      {
        icon: "issue",
        source: "GitHub · miuki/app",
        ask: "Abre uma issue pro bug do login no Safari",
        status: "Conectando ao GitHub",
        title: "Nova issue",
        to: "Bug: login com Google falha no Safari",
        body: "Ao entrar com Google no Safari 18, volta para a tela de login. Labels: bug, auth.",
        cta: "Criar issue",
        done: "Issue #214 criada",
      },
      {
        icon: "mail",
        source: "Gmail · Caixa de entrada",
        ask: "Manda um e-mail pro Daniel avisando que o contrato chega até 13h",
        status: "Conectando ao Gmail",
        title: "E-mail para o Daniel",
        to: "Para: Daniel Costa",
        body: "Oi Daniel, o contrato assinado chega até as 13h de hoje. Qualquer coisa, me avisa!",
        cta: "Enviar",
        done: "E-mail enviado",
      },
    ],
  },
} as const;
