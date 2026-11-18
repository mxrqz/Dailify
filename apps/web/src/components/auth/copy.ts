/**
 * Dicionário de copy pt-BR das telas de auth, espelhando `landing/copy.ts` e `dashboard/copy.ts`.
 *
 * Estruturado plano — cada chave é uma string final pronta pra renderizar. A exceção é o rodapé
 * legal, quebrado em quatro chaves porque tem dois links inline; a alternativa seria HTML dentro
 * da string, que é pior. Quatro partes também sobrevivem à tradução, onde a ordem pode mudar.
 *
 * `AuthCopy` é a preparação inteira pro locale `en` da bd Dailify-1xy: um dicionário futuro nasce
 * como `const en: AuthCopy = {...}` e o TypeScript cobra chave faltando. Não existe `en` aqui.
 */
export const copy = {
  shell: {
    back: "Voltar",
    dividerOr: "ou",
    emailLabel: "E-mail",
    emailPlaceholder: "voce@exemplo.com",
    continueWithGoogle: "Continuar com Google",
    terms: "Termos de Serviço",
    privacy: "Política de Privacidade",
    legalAnd: " e a ",
  },

  signIn: {
    pageTitle: "Mewki — Entrar",
    title: "Entrar",
    subtitle: "Mandamos um link de acesso. Sem senha.",
    bubble: "Oi! Qual é o seu e-mail?",
    submit: "Continuar com e-mail",
    crossLinkPrefix: "Novo por aqui?",
    crossLinkAction: "Criar conta",
    legalPrefix: "Ao continuar, você concorda com os ",
  },

  signUp: {
    pageTitle: "Mewki — Criar conta",
    title: "Criar conta",
    subtitle: "Só o e-mail. Mandamos um link de acesso, sem senha.",
    bubble: "Oi! Vamos começar?",
    submit: "Continuar com e-mail",
    crossLinkPrefix: "Já tem conta?",
    crossLinkAction: "Entrar",
    legalPrefix: "Ao criar uma conta, você concorda com os ",
  },

  inbox: {
    bubble: "Prontinho, mandei o link!",
    title: "Confira seu e-mail",
    sentTo: "Enviamos um link de acesso para",
    // 10 minutos é o `expiresIn` do magicLink no servidor (apps/server). Se mudar lá, mude aqui.
    hint: "Clique no link para entrar. Ele vale por 10 minutos.",
    resend: "Reenviar link",
    resendIn: "Reenviar em {seconds}s",
    back: "Usar outro e-mail",
    spam: "Não chegou? Olhe a caixa de spam ou promoções.",
  },

  verify: {
    pageTitle: "Mewki — Entrar",
    ready: "Tudo certo. Toque em Entrar para abrir sua conta.",
    submit: "Entrar",
    invalid: "Este link expirou ou já foi usado.",
    restart: "Pedir novo link",
  },

  app: {
    pageTitle: "Mewki — Abrir no app",
    desktop: "Abrindo a Mewki… Se nada aconteceu, use o botão abaixo.",
    mobile: "Este link entra pelo app da Mewki, que não está instalado neste aparelho.",
    open: "Abrir na Mewki",
    browser: "Entrar pelo navegador",
  },

  appReturn: {
    pageTitle: "Mewki — Voltar para o app",
    message: "Tudo certo por aqui. Volte para o app da Mewki para continuar.",
    open: "Abrir na Mewki",
    browser: "Continuar no navegador",
  },

  errors: {
    invalidEmail: "E-mail inválido.",
    captcha: "A verificação de segurança falhou. Recarregue a página e tente de novo.",
    tooManyRequests: "Muitas tentativas. Espere um minuto e tente de novo.",
    network: "Sem conexão. Confira sua internet e tente de novo.",
    // Excluir a conta pede uma sessão recente: o /profile sai e volta pra cá com `?error=SESSION_EXPIRED`.
    reauth: "Por segurança, entre de novo e repita a exclusão.",
    generic: "Algo deu errado. Tente de novo.",
  },
} as const;

/** O contrato que um locale futuro precisa cumprir (bd Dailify-1xy). */
export type AuthCopy = typeof copy;
