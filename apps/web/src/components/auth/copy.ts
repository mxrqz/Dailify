import type { LinkFailure } from "@/lib/native-auth";
import type { AuthErrorKey } from "./auth-state";

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
    passkey: "Entrar com passkey",
    passwordLabel: "Senha",
    // 10 and 128 = `minPasswordLength`/`maxPasswordLength` in apps/server/src/auth-options.ts.
    newPasswordHint: "Pelo menos 10 caracteres.",
    forgotPassword: "Esqueci a senha",
    emailLink: "Receber link por e-mail",
    usePassword: "Entrar com senha",
    terms: "Termos de Serviço",
    privacy: "Política de Privacidade",
    legalAnd: " e a ",
  },

  signIn: {
    pageTitle: "Mewki — Entrar",
    title: "Entrar",
    subtitle: "Bom te ver de novo.",
    linkSubtitle: "Mandamos um link de acesso. Sem senha.",
    bubble: "Oi! Qual é o seu e-mail?",
    submit: "Continuar com e-mail",
    passwordSubmit: "Entrar",
    crossLinkPrefix: "Novo por aqui?",
    crossLinkAction: "Criar conta",
    legalPrefix: "Ao continuar, você concorda com os ",
  },

  signUp: {
    pageTitle: "Mewki — Criar conta",
    title: "Criar conta",
    subtitle: "Com e-mail e senha. Ou só o e-mail, com um link de acesso.",
    linkSubtitle: "Só o e-mail. Mandamos um link de acesso, sem senha.",
    bubble: "Oi! Vamos começar?",
    submit: "Continuar com e-mail",
    passwordSubmit: "Criar conta",
    crossLinkPrefix: "Já tem conta?",
    crossLinkAction: "Entrar",
    legalPrefix: "Ao criar uma conta, você concorda com os ",
  },

  inbox: {
    bubble: "Prontinho, mandei o link!",
    title: "Confira seu e-mail",
    sentTo: "Enviamos um link de acesso para",
    // 10 minutos é o `expiresIn` do magicLink no servidor (apps/server). Se mudar lá, mude aqui.
    hint: "Toque no link ou digite o código do e-mail. Os dois valem por 10 minutos.",
    codeLabel: "Código de 6 dígitos",
    codeSubmit: "Entrar com o código",
    resend: "Reenviar link",
    resendIn: "Reenviar em {seconds}s",
    back: "Usar outro e-mail",
    spam: "Não chegou? Olhe a caixa de spam ou promoções.",
  },

  // Sign-up with a password: no session until the e-mail is confirmed.
  verifySent: {
    bubble: "Falta só confirmar!",
    title: "Confirme seu e-mail",
    sentTo: "Mandamos um link de confirmação para",
    hint: "Toque no link do e-mail e você já entra.",
    back: "Usar outro e-mail",
  },

  // /reset-password: ask for the link, then pick the new password from it.
  reset: {
    pageTitle: "Mewki — Redefinir senha",
    title: "Redefinir senha",
    subtitle: "Mandamos um link para você escolher uma senha nova.",
    request: "Enviar link",
    sent: "Se existir uma conta com este e-mail, o link chega em instantes. Ele vale por 1 hora.",
    newTitle: "Escolha uma senha nova",
    newLabel: "Senha nova",
    submit: "Salvar senha",
    done: "Senha alterada. Entre com a senha nova.",
    invalid: "Este link expirou ou já foi usado. Peça outro.",
    toLogin: "Ir para o login",
  },

  // The second factor: at sign-in (/two-factor) and before a sensitive action (step-up dialog).
  mfa: {
    pageTitle: "Mewki — Verificação em duas etapas",
    title: "Confirme que é você",
    totp: "Digite o código de 6 números do seu app autenticador.",
    otp: "Digite o código de 6 números que mandamos para o seu e-mail.",
    backup: "Digite um dos seus códigos de recuperação.",
    backupLabel: "Código de recuperação",
    submit: "Confirmar",
    trust: "Confiar neste aparelho por 30 dias",
    useEmail: "Receber um código por e-mail",
    useBackup: "Usar um código de recuperação",
    useApp: "Usar o app autenticador",
    emailSent: "Código enviado. Confira seu e-mail.",
    stepUp: "Para continuar, confirme com o seu segundo fator.",
    cancel: "Cancelar",
  },

  // Turning MFA on (/security).
  mfaSetup: {
    title: "Duas etapas",
    step1: "1. Adicione a Mewki no seu app de códigos",
    addAuto: "Adicionar automaticamente",
    addAutoHint:
      "Abre o app de códigos do celular: Senhas do iPhone, Google Authenticator, Microsoft Authenticator, 1Password…",
    scan: "Aponte a câmera do celular para o código, no seu app de códigos.",
    qrLabel: "QR code para o app de códigos",
    addManual: "Adicionar manualmente",
    copyKey: "Copiar chave",
    step2: "2. Digite o código que apareceu",
    activate: "Ativar",
    codesTitle: "Guarde seus códigos de recuperação",
    codesHint: "Se perder o celular, cada código entra uma vez. Guarde num lugar seguro.",
    copy: "Copiar",
    download: "Baixar .txt",
    copied: "Copiado.",
    fileName: "mewki-codigos-de-recuperacao.txt",
    done: "Pronto",
    password: "Confirme sua senha para continuar.",
    continue: "Continuar",
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

  // /oauth/consent: an AI assistant (Claude, ChatGPT, Gemini) asks for the agenda over MCP.
  consent: {
    pageTitle: "Mewki — Conectar assistente",
    bubble: "Alguém quer me ajudar com a sua agenda!",
    title: "Conectar {client}?",
    unknownClient: "um assistente",
    grants: "Ele vai poder ver e editar suas tarefas.",
    returnsTo: "Depois você volta para {host}.",
    allow: "Permitir",
    deny: "Não permitir",
    failed: "Não deu para concluir. Volte ao assistente e tente conectar de novo.",
  },

  errors: {
    invalidEmail: "E-mail inválido.",
    captcha: "A verificação de segurança falhou. Recarregue a página e tente de novo.",
    tooManyRequests: "Muitas tentativas. Espere um minuto e tente de novo.",
    network: "Sem conexão. Confira sua internet e tente de novo.",
    // Deleting the account or adding a passkey needs a recent session: both sign out and come back
    // here with `?error=SESSION_EXPIRED`.
    reauth: "Por segurança, entre de novo e repita o que estava fazendo.",
    invalidCode: "Código incorreto. Confira o e-mail e tente de novo.",
    // Expired, or burned by too many wrong tries: either way only a new e-mail helps.
    staleCode: "Este código não vale mais. Reenvie para receber outro.",
    wrongPassword: "E-mail ou senha incorretos.",
    passwordRules: "A senha precisa ter de 10 a 128 caracteres.",
    passwordCompromised: "Esta senha apareceu num vazamento de dados. Escolha outra.",
    emailNotVerified: "Confirme seu e-mail primeiro. Mandamos um link novo.",
    staleChallenge: "Passou tempo demais. Entre de novo.",
    passkeyFailed: "Não deu para usar a passkey. Tente de novo ou entre de outro jeito.",
    generic: "Algo deu errado. Tente de novo.",
  } satisfies Record<AuthErrorKey, string>,

  // The app's toast when an e-mailed link opens it and fails (main.tsx).
  linkErrors: {
    otherDevice:
      "Este link foi pedido em outro aparelho ou por um pedido mais novo. Use o código do e-mail ou peça outro link.",
    expired: "Este link expirou ou já foi usado. Peça um novo.",
    tooManyRequests: "Muitas tentativas. Espere um minuto e tente de novo.",
    network: "Sem conexão. Confira sua internet e abra o link de novo.",
    generic: "Não deu para entrar com este link. Tente de novo.",
  } satisfies Record<LinkFailure, string>,
} as const;

/** O contrato que um locale futuro precisa cumprir (bd Dailify-1xy). */
export type AuthCopy = typeof copy;
