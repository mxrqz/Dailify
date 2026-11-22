import { APP_URL } from "@dailify/shared";

import { button, code, details, type Details, type Email, layout, para } from "./layout";

// A code never goes in the subject: lock-screen notifications show it to anyone nearby.

const SECURITY_FOOTER =
  "Avisos de segurança não podem ser desligados: são como a Mew protege a sua conta.";
const NOT_ME = button("Não fui eu", `${APP_URL}/security`);

export function signIn(url: string, ttlMinutes: number, otp?: string): Email {
  return layout({
    subject: "Seu link para entrar na Mewki",
    title: "Entrar na Mewki",
    intro: otp
      ? `Toque no botão pra entrar. O link e o código valem por ${ttlMinutes} minutos e só funcionam uma vez.`
      : `Toque no botão pra entrar. O link vale por ${ttlMinutes} minutos e só funciona uma vez.`,
    parts: [
      button("Entrar na Mewki", url),
      ...(otp ? [code(otp, "Ou digite este código no app")] : []),
    ],
    notYou: [
      "Não pediu? Pode ignorar este e-mail. Sem o link ou o código, ninguém entra na sua conta.",
    ],
    fallback: url,
    reason: "Você recebeu este e-mail porque alguém pediu pra entrar com este endereço.",
  });
}

export function verifyEmail(url: string): Email {
  return layout({
    subject: "Confirme seu e-mail na Mewki",
    title: "Confirme seu e-mail",
    intro:
      "Falta só isso pra sua conta ficar pronta. Confirmando, a Mew sabe que este endereço é seu e pode te avisar de coisas importantes.",
    parts: [button("Confirmar e-mail", url)],
    notYou: ["Não criou uma conta? Pode ignorar. Sem confirmar, ninguém usa este e-mail na Mewki."],
    fallback: url,
    reason: "Você recebeu este e-mail porque uma conta foi criada com este endereço.",
  });
}

export function resetPassword(url: string, rows: Details): Email {
  return layout({
    subject: "Redefinir sua senha da Mewki",
    title: "Redefinir sua senha",
    intro:
      "Alguém pediu pra trocar a senha da sua conta. Se foi você, toque no botão e escolha uma nova.",
    parts: [button("Escolher nova senha", url), details(rows)],
    notYou: [
      "Não foi você? Sua senha continua a mesma. Se isso se repetir, ative a verificação em duas etapas em Segurança.",
      "Trocar a senha encerra a sessão nos outros aparelhos.",
    ],
    fallback: url,
    reason: "Você recebeu este e-mail porque alguém pediu pra redefinir a senha desta conta.",
  });
}

export function mfaCode(otp: string, rows: Details): Email {
  return layout({
    subject: "Seu código de verificação da Mewki",
    title: "Seu código de verificação",
    intro: "Use este código pra confirmar que é você. Ele vale por 10 minutos.",
    parts: [
      code(otp),
      details(rows),
      para("Nunca compartilhe este código. A Mewki e a Mew nunca vão pedir ele pra você."),
    ],
    notYou: [
      "Não foi você? Alguém tem a sua senha. Troque a senha agora e confira os aparelhos conectados em Segurança.",
    ],
    reason: "Você recebeu este e-mail porque a verificação em duas etapas está ativa nesta conta.",
  });
}

export function newSignIn(rows: Details): Email {
  return layout({
    subject: "Novo acesso à sua conta da Mewki",
    title: "Novo acesso à sua conta",
    intro: "Alguém entrou na sua conta num aparelho que a Mew ainda não conhecia.",
    parts: [
      details(rows),
      para("Foi você? Então está tudo certo, não precisa fazer nada."),
      NOT_ME,
    ],
    notYou: [
      "“Não fui eu” encerra essa sessão, pede uma senha nova e mostra como ativar a verificação em duas etapas.",
    ],
    reason: SECURITY_FOOTER,
  });
}

export type SecurityChange =
  "password" | "passkeyAdded" | "passkeyRemoved" | "mfaOn" | "mfaOff" | "emailChanged";

const CHANGES = {
  password: [
    "Sua senha foi alterada",
    "A senha da sua conta mudou. Por segurança, a Mew encerrou a sessão nos outros aparelhos.",
  ],
  passkeyAdded: [
    "Uma passkey foi adicionada",
    "Uma nova passkey agora entra na sua conta, sem senha.",
  ],
  passkeyRemoved: ["Uma passkey foi removida", "Uma passkey não entra mais na sua conta."],
  mfaOn: [
    "Verificação em duas etapas ativada",
    "Entrar na sua conta agora pede um código além da senha.",
  ],
  mfaOff: [
    "Verificação em duas etapas desativada",
    "Entrar na sua conta não pede mais o código extra. A conta fica menos protegida.",
  ],
  emailChanged: [
    "O e-mail da sua conta mudou",
    "A sua conta agora usa outro endereço. Este aviso vem pro e-mail antigo.",
  ],
} satisfies Record<SecurityChange, readonly [title: string, intro: string]>;

export function securityChanged(kind: SecurityChange, rows: Details): Email {
  const [title, intro] = CHANGES[kind];
  return layout({
    subject: title,
    title,
    intro,
    parts: [details(rows), para("Foi você? Pronto, nada mais a fazer."), NOT_ME],
    notYou: ["“Não fui eu” encerra as outras sessões e mostra como proteger a sua conta."],
    reason: SECURITY_FOOTER,
  });
}

export function accountDeleted(): Email {
  return layout({
    subject: "Sua conta da Mewki foi excluída",
    title: "Sua conta foi excluída",
    intro:
      "Como você pediu, apagamos a sua conta e tudo o que estava nela. Foi bom organizar seus dias com você.",
    parts: [
      details([
        ["Tarefas, conversas e configurações", "apagadas"],
        ["Apps conectados", "desconectados e com acesso revogado"],
        ["Assinatura", "cancelada, sem novas cobranças"],
      ]),
      para("Se mudar de ideia, é só criar uma conta nova quando quiser."),
    ],
    notYou: [
      "Não pediu isso? Responda este e-mail agora: guardamos registros de segurança por 30 dias.",
    ],
    reason: "Este é o último e-mail que você recebe da Mewki.",
  });
}
