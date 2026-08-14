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
    dividerOr: "ou",
    emailLabel: "E-mail",
    emailPlaceholder: "voce@exemplo.com",
    continueWithEmail: "Continuar com e-mail",
    continueWithGoogle: "Continuar com Google",
    terms: "Termos de Serviço",
    privacy: "Política de Privacidade",
    legalAnd: " e a ",
  },

  signIn: {
    pageTitle: "Dailify — Entrar",
    title: "Entrar",
    submit: "Continuar com e-mail",
    crossLinkPrefix: "Novo por aqui?",
    crossLinkAction: "Criar conta",
    legalPrefix: "Ao continuar, você concorda com os ",
  },

  signUp: {
    pageTitle: "Dailify — Criar conta",
    title: "Criar conta",
    submit: "Continuar com e-mail",
    crossLinkPrefix: "Já tem conta?",
    crossLinkAction: "Entrar",
    legalPrefix: "Ao criar uma conta, você concorda com os ",
  },

  inbox: {
    title: "Confira seu e-mail",
    sentTo: "Enviamos um link de acesso para",
    // 10 minutos é a expiração padrão do Clerk. Se mudar no dashboard, mude aqui.
    hint: "Clique no link para entrar. Ele vale por 10 minutos.",
    resend: "Reenviar link",
    resendIn: "Reenviar em",
    seconds: "s",
    back: "Usar outro e-mail",
  },

  verify: {
    pageTitle: "Dailify — Verificação",
    loading: "Verificando…",
    verified: "Pronto. Pode fechar esta aba.",
    switchTab: "Verificado. Volte para a aba onde você começou.",
    expired: "Este link expirou.",
    clientMismatch: "Abra o link no mesmo navegador em que você começou.",
    failed: "Não foi possível verificar este link.",
    restart: "Tentar de novo",
  },

  errors: {
    invalidEmail: "E-mail inválido.",
    blockedEmail: "E-mails temporários não são aceitos. Use seu e-mail de sempre.",
    captcha: "A verificação de segurança falhou. Recarregue a página e tente de novo.",
    tooManyRequests: "Muitas tentativas. Espere um minuto e tente de novo.",
    expiredLink: "Seu link expirou. Peça um novo.",
    generic: "Algo deu errado. Tente de novo.",
    offerSignUp: "Não achei uma conta com esse e-mail.",
    offerSignUpAction: "Criar conta",
    offerSignIn: "Já existe uma conta com esse e-mail.",
    offerSignInAction: "Entrar",
  },
} as const;

/** O contrato que um locale futuro precisa cumprir (bd Dailify-1xy). */
export type AuthCopy = typeof copy;
