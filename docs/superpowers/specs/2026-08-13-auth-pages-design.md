# `/login` e `/signup` — retrabalho das telas de auth

**Data:** 2026-08-13
**Branch:** `worktree-auth-redesign`
**Encosta em:** `Dailify-1xy` (locale en), `Dailify-17s` (camada de i18n)

## Problema

A landing passou por um passe visual completo (spec `2026-08-09-landing-visual-pass-design.md`) e o
dashboard passou pelo seu (spec `2026-08-10-dashboard-redesign-design.md`). Sobrou uma porta de
entrada que não recebeu nenhum dos dois: `/login` é a última tela do app ainda no estado
pré-redesign.

O contraste, arquivo por arquivo:

| | Landing / dashboard | `/login` |
| --- | --- | --- |
| superfície | `surface-page` / `card` / `line` | `Card` shadcn cru |
| raio | `rounded-panel` (1.375rem) | `rounded-lg` do shadcn |
| largura | contida | `md:max-w-1/2` — metade da viewport em 1440px |
| dado de máquina | `font-mono text-2xs uppercase` | `<Label>` padrão |
| idioma | pt-BR via `copy.ts` | inglês, e com resquício de outro produto |
| erro | toast / mensagem | `console.error` |

Mas o problema não é só pintura. Três defeitos estruturais:

**1. Não existe conceito de cadastro.** `login.tsx:69-99` faz um *sign-in-or-up* implícito: tenta
`signIn.create`, e quando o Clerk responde `form_identifier_not_found`, cria a conta em silêncio. O
usuário digita o e-mail e recebe um link — sem nunca saber se entrou numa conta existente ou acabou
de criar uma. A landing vende "Começar — é grátis" e entrega uma tela escrita "Login to continue".

**2. `verify.tsx` mente.** A tela nunca chama `handleEmailLinkVerification`. É estática: sempre
renderiza "Authentication Successful" / "You have been successfully logged in" e chama
`window.close()` depois de 5 segundos (`verify.tsx:9-19`). Ela diz isso quando o link expirou,
quando a verificação falhou, e quando o link foi aberto no celular — onde a sessão *não* nasce.

O caminho feliz funciona por acidente: quem completa o login é a aba original, bloqueada no
`await startEmailLinkFlow`. A aba do e-mail só precisava dizer "pode fechar". Ela diz "você está
logado", que é falso em metade dos casos.

**3. O fluxo não tem estados.** Existe um booleano `verifying` (`login.tsx:37`) e mais nada. Todo
`catch` é `console.error` (`:88`, `:107`). E-mail inválido, rate limit, link expirado — a tela não
faz nada e o usuário fica olhando. O botão "Resend link" está comentado desde sempre
(`verifying-link.tsx:35-38`). É o dead-end clássico de magic link.

E um bug que só aparece em dev: `dailifyURL` é hardcoded como `https://dailify.mxrqz.com/`
(`conts.ts:76`) e é a base do `redirectUrl` do link. Rodando local, o e-mail chega com um link que
aponta pra produção.

## Decisões

Fechadas no brainstorm, com o racional de cada uma:

**Duas rotas, mesmo motor.** No mundo passwordless, entrar e criar conta são mecanicamente a mesma
ação — digita e-mail, recebe link. A separação é de *enquadramento*, não de mecânica: `/login` é
portão de retorno, `/signup` carrega a promessa do produto. O Clerk continua resolvendo sozinho quem
já tem conta; o fallback `signIn → signUp` permanece, só que agora dizendo ao usuário o que
aconteceu.

**Segue o tema, no vocabulário do app.** Não uma tela sempre-escura. Quem usa tema claro sairia de
um preto e cairia num dashboard branco — um flash de tema errado no exato momento em que o app
deveria parecer coeso.

**Google só.** Apple sai do fluxo, de `logos.tsx` e da tela. Sign in with Apple exige conta paga no
Apple Developer Program; manter um botão que pode não estar configurado é um caminho de erro sem
dono.

**Copy só em pt-BR, mas não hardcoded.** Nada de dicionário `en` agora — o app inteiro é pt-BR e um
locale que ninguém usa é código morto. O que entra é a *forma*: toda string sai do JSX e vai pra
`auth/copy.ts`, plana e sem concatenação, exatamente como `landing/copy.ts` e `dashboard/copy.ts` já
fazem. Quando `Dailify-1xy` chegar, o `en` é um objeto novo, não um refactor.

## Design

### 1. Rotas

| Rota | Hoje | Depois |
| --- | --- | --- |
| `/login` | tela única, sign-in-or-up implícito | entrar |
| `/signup` | não existe | criar conta |
| `/login/sso-callback` | callback OAuth | `/sso-callback`, serve as duas |
| `/sign-in/verify` | tela que mente | `/verify`, lê o status real |

O callback de OAuth vira uma rota só porque o destino já viaja no `redirectUrlComplete` — não há
nada de "login" nele que o diferencie de um "signup". Manter dois seria duplicar por simetria falsa.

`ProtectedRoute` continua mandando pra `/login` com `state.from` (`protected-route.tsx:128`);
`/signup` aceita o mesmo `state` e o mesmo `redirectTarget()`. Os CTAs da landing repartem por
intenção:

| Origem | Hoje | Depois | Por quê |
| --- | --- | --- | --- |
| `landing/cta.tsx:45` | `/login` | `/signup` | é o CTA de conversão |
| `landing/hero.tsx:58` (`ctaPrimary`) | **não navega** | `/signup` | idem — ver abaixo |
| `landing/hero.tsx:65` (`ctaSecondary`) | **não navega** | `#features` | é o "ver como funciona" |
| `site-header.tsx:29` ("Entrar") | `/login` | `/login` | é retorno |
| `app-header.tsx:86` | `/login` | `/login` | idem |
| `premium.tsx:340` | `/login` | `/login` | idem |

**O CTA principal da landing é um botão morto.** `hero.tsx:58-72` são dois `<Button>` sem `asChild`,
sem `Link` e sem `onClick` — clicar em "Começar — é grátis" não faz nada. Passou despercebido no
passe visual da landing porque a tela estava certa; só o comportamento não existia. Cai junto aqui
porque é exatamente o link que este spec cria o destino.

### 2. Anatomia da tela

O card fica centrado na viewport. A marca é posicionada em absoluto 40px acima dele, e o rodapé
legal em absoluto a 20px do fundo da página — nenhum dos dois participa do fluxo do card.

```
 ┌───────────────────────────────────────────────┐
 │                surface-page                   │
 │                                               │
 │                                               │
 │              [logo] Dailify                   │ ← absolute bottom-full mb-10
 │                                               │
 │                  Entrar                       │ ← título, dentro do bloco
 │        ┌───────────────────────────────┐      │
 │        │  surface-card  rounded-panel  │      │   max-w-[380px]
 │        │  border-surface-line          │      │   shadow-panel
 │        │                               │      │
 │        │  E-MAIL                       │      │ ← mono 2xs uppercase .04em
 │        │  [                         ]  │      │
 │        │  [ Continuar com e-mail   → ] │      │ ← primary
 │        │                               │      │
 │        │  ──────────  ou  ──────────   │      │
 │        │                               │      │
 │        │  [ G  Continuar com Google  ] │      │ ← outline
 │        │                               │      │
 │        │  Novo por aqui? Criar conta → │      │ ← única diferença estrutural
 │        └───────────────────────────────┘      │
 │                                               │
 │                                               │
 │      Ao criar uma conta, você concorda        │ ← absolute inset-x-0 bottom-5
 │      com os Termos e a Privacidade            │
 └───────────────────────────────────────────────┘
```

Implementação do posicionamento, sem medir nada em JS:

- Container: `relative grid min-h-dvh place-items-center bg-surface-page`
- Bloco central: `relative w-full max-w-[380px]` — o título e o card vivem aqui
- Marca: `absolute bottom-full left-1/2 -translate-x-1/2 mb-10` (`mb-10` = 2.5rem = 40px)
- Rodapé: `absolute inset-x-0 bottom-5` (`bottom-5` = 1.25rem = 20px)

O que fica centrado na viewport é o **bloco** (título + card), não o card sozinho — é o que a
referência mostra e o que evita o card parecer alto demais. A marca fica 40px acima do título, e
por estar em `absolute` não empurra nada: tirar ou trocar o logo não move o card um pixel.

`min-h-dvh` em vez de `h-dvh`: numa viewport curta (paisagem no celular, janela baixa no desktop) a
marca em absoluto sairia por cima do topo. Com `min-h`, a página rola em vez de cortar.

**Referência:** `auth-kit.mastra.ai/sign-up` — que é a UI hospedada do WorkOS AuthKit com a marca da
mastra por cima (a rota redireciona pra `api.workos.com/user_management/authorize`). A ordem dos
elementos é copiada de lá: logo, título, label + input, botão de e-mail primário, divisor, OAuth,
cross-link, rodapé legal. Não é originalidade desperdiçada — é a ordem que todo usuário já sabe ler,
e uma tela de login não é lugar pra ensinar um padrão novo.

A única divergência deliberada é a label do campo: `font-mono text-2xs uppercase tracking-[0.04em]`
em vez do label neutro do AuthKit. É o mesmo tratamento de "dado de máquina" que a landing e o
dashboard usam, e é o que impede a tela de parecer a auth de qualquer outro produto.

### 3. Arquivos

```
components/auth/
  auth-shell.tsx          marca + título + card + rodapé legal; recebe title/footer/children
  oauth-buttons.tsx       só Google
  email-form.tsx          input + erro inline + submit com loading
  check-inbox.tsx         "veja seu e-mail" + reenviar com cooldown
  auth-state.ts           LÓGICA PURA: reducer, mapa de erros, redirectTarget, cooldown
  auth-state.test.ts
  use-email-link-auth.ts  a casca React: chama o Clerk e despacha no reducer
  copy.ts                 pt-BR + export type AuthCopy
  copy.test.ts

pages/
  login.tsx               ~40 linhas: <AuthShell> + copy.signIn
  signup.tsx              ~40 linhas: <AuthShell> + copy.signUp
  verify.tsx              reescrita: lê o status real
```

Apagados, absorvidos pelos acima: `components/verifying-link.tsx` (51 linhas),
`components/sso-callback.tsx` (5 linhas). `components/logos.tsx` perde o `AppleLogo`.

A divisão espelha como `landing/` e `dashboard/` já são organizados no repo: componentes pequenos e
focados, mais um `copy.ts` como fonte única do texto.

**Por que `auth-state.ts` é separado do hook.** O repo não tem `@testing-library/react` nem jsdom —
os 8 arquivos de teste são `.test.ts` de lógica pura e o vitest roda em node. Testar um hook com o
Clerk mockado custaria duas dependências novas de dev. Em vez disso, tudo que merece teste sai do
React: o reducer, o mapa de erros, o `redirectTarget` e a regra de cooldown viram funções puras em
`auth-state.ts`, e `use-email-link-auth.ts` fica sendo só o fio que liga o Clerk ao reducer. É a
mesma postura que o repo já tem — nenhum componente é testado, só lógica.

### 4. A máquina de estados

É o que hoje não existe, e a razão de a tela travar em silêncio.

```
  idle ──submit──> sending ──ok──> awaitingLink ──verificado──> redireciona p/ `from`
   ▲                  │                  │
   │                  │ erro             │ expirou / falhou
   │                  ▼                  ▼
   └──────────────  error  <─────────  expired ──"reenviar"──> sending
                                          (cooldown de 30s no botão)
```

O hook expõe `{ status, error, email, submit, resend, reset, resendCooldown }`. `status` é uma união
discriminada — `"idle" | "sending" | "awaitingLink" | "expired" | "error"` — e não um par de
booleanos, porque os estados são mutuamente exclusivos e o par admite combinações impossíveis
(`verifying && error`), que é exatamente onde o código atual se perde.

**Mapa de erros.** Cada `code` do Clerk vira uma mensagem, em vez de `console.error`:

| `code` do Clerk | `/login` | `/signup` |
| --- | --- | --- |
| `form_identifier_not_found` | oferece ir pro `/signup` | caminho normal — cria a conta |
| `form_identifier_exists` | caminho normal — entra | oferece ir pro `/login` |
| `form_param_format_invalid` | "E-mail inválido" | idem |
| `too_many_requests` | "Muitas tentativas. Espere um minuto." | idem |
| qualquer outro | mensagem genérica + o `code` em mono pequeno | idem |

O `code` cru aparece na mensagem genérica de propósito: é o que torna um relato de bug utilizável.

**Cooldown do reenvio.** 30 segundos, contados no cliente. Não é segurança — o rate limit real é do
Clerk (`too_many_requests`). É pra impedir que o usuário dispare cinco e-mails e depois não saiba
qual link é o válido, que é o modo de falha mais comum de magic link.

### 5. `/verify` honesta

A tela passa a chamar `handleEmailLinkVerification` e a renderizar o resultado real. Os estados vêm
da própria API do Clerk:

| Status | O que a tela diz |
| --- | --- |
| `loading` | spinner |
| `verified` | "Pronto. Pode fechar esta aba." |
| `verified_switch_tab` | "Verificado. Volte para a aba onde você começou." |
| `expired` | "Este link expirou." + botão pra pedir outro |
| `client_mismatch` | "Abra o link no mesmo navegador em que você começou." |
| `failed` | "Não foi possível verificar." + botão pra recomeçar |

O `window.close()` sai. Ele não funciona em abas que o script não abriu — o navegador ignora — então
hoje o contador de 5 segundos termina em nada. O texto passa a instruir em vez de prometer.

`verified_switch_tab` e `client_mismatch` são os dois casos que explicam o comportamento
cross-device que hoje aparece como uma mentira. `client_mismatch` só ocorre se "Require the same
device and browser" estiver ligado no dashboard do Clerk; a tela trata o caso de qualquer forma,
porque o custo é um `if` e a alternativa é um dead-end sem explicação.

### 6. Copy — pt-BR, com a forma pronta pro `en`

`auth/copy.ts` é um dicionário só, em pt-BR, no mesmo formato dos outros dois do repo:

```ts
export const copy = { ... } as const
export type AuthCopy = typeof copy   // o contrato que um locale futuro precisa cumprir
```

O `export type` é a preparação inteira. Quando `Dailify-1xy` chegar, `en` nasce como
`const en: AuthCopy = { ... }` e o TypeScript reprova o build se faltar uma chave. Não há
`navigator.language`, não há seletor e não há um objeto `en` vazio esperando — nada disso existe até
alguém precisar. A regra que vale hoje é mais simples: **nenhuma string visível dentro do JSX.**

**O rodapé legal quebra a convenção de string plana**, e de propósito. `dashboard/copy.ts` diz que
cada chave é "uma string final pronta pra renderizar", mas esse texto tem dois links inline. Fica
em quatro chaves (`legalPrefix`, `terms`, `legalAnd`, `privacy`) montadas no JSX. A alternativa —
`dangerouslySetInnerHTML` com `<a>` embutido na string — é pior. Quatro chaves também é o que
sobrevive à tradução: em outra língua a ordem das partes pode mudar sem quebrar o tipo.

O rodapé muda por página, porque só uma delas cria conta:

| | Texto |
| --- | --- |
| `/signup` | "Ao criar uma conta, você concorda com os **Termos de Serviço** e a **Política de Privacidade**" |
| `/login` | "Ao continuar, você concorda com os **Termos de Serviço** e a **Política de Privacidade**" |

Os links apontam pra `/termos` e `/privacidade`, que já existem e já estão em pt-BR — coerentes com
a tela.

### 7. Defeitos que caem junto

| Defeito | Onde | Correção |
| --- | --- | --- |
| magic link de dev aponta pra prod | `conts.ts:76` | `window.location.origin` |
| todo erro é `console.error` | `login.tsx:88`, `:107` | estado `error` renderizado |
| sem reenviar link | `verifying-link.tsx:35` | botão real, cooldown de 30s |
| `/verify` sempre diz "sucesso" | `verify.tsx:30` | status real do Clerk |
| botão "Logout" dentro do login | `login.tsx:184` | sai — se já logado, redireciona pro `from` |
| "sign in to your **Schedule**" | `verifying-link.tsx:29` | `auth/copy.ts` |
| "10 minutos" hardcoded | `verifying-link.tsx:29` | fica, com comentário — precisa casar com a expiração do dashboard do Clerk |

`dailifyURL` continua existindo em `conts.ts` — ele tem outros usos. O que muda é o fluxo de auth
deixar de usá-lo pra montar `redirectUrl`.

### 8. Anexo — tema do sistema

Pedido à parte, mas pequeno e do mesmo território (a tela de auth acabou de virar theme-aware).

**`system` não é o padrão, apesar das aparências.** `theme-provider.tsx:29` declara
`defaultTheme = "system"`, mas `App.tsx:26` monta o provider como `<ThemeProvider defaultTheme="dark">`
e sobrescreve. Quem abre o app pela primeira vez recebe dark, independente do SO. A correção é a
linha do `App.tsx`, não a do provider — o default do provider já estava certo.

Feita essa troca, o toggle já tem a opção `system` (`mode-toggle.tsx:33`), mas ela não funciona
direito. Faltam três coisas:

**Não reage ao SO em tempo real.** `theme-provider.tsx:44` lê `matchMedia` uma vez, dentro do efeito
que depende de `[theme]`. Se o usuário está em `system` e o SO alterna sozinho (modo noturno
automático), a página só acompanha depois de um reload. Correção: registrar um listener de `change`
no `MediaQueryList` enquanto `theme === "system"`, e removê-lo no cleanup.

**Flash de tema errado no carregamento.** A classe é aplicada num `useEffect`, depois do primeiro
paint, e `index.html` não tem script inline. Quem usa dark vê um flash claro em toda navegação
direta. Correção: um script inline no `<head>` que lê o mesmo `localStorage["vite-ui-theme"]` e
aplica a classe antes do bundle. A chave e a lógica precisam ficar idênticas às do provider —
divergir aqui produz um flash pior que o atual.

**O toggle não mostra o estado.** Três `DropdownMenuItem` iguais; não dá pra saber se você está em
"System" ou "Dark". Vira `DropdownMenuRadioGroup` com `value={theme}`, e os rótulos vão pra pt-BR
("Claro" / "Escuro" / "Sistema"), junto com o `sr-only` "Toggle theme".

## Testes

`auth-state.test.ts` — funções puras, sem mock e sem renderizar:

- `authReducer`: cada transição da máquina, e que ações inválidas pro estado atual não mudam nada
- `authErrorMessage`: cada `code` do Clerk produz a mensagem esperada, em cada modo (`signIn`/`signUp`)
- `redirectTarget`: extrai `pathname + search` do `location.state`, e cai em `/dashboard` pra todo
  formato inesperado (hoje isso existe em `login.tsx:19-26` e nunca foi testado)
- `canResend`: bloqueia dentro dos 30s, libera depois

`copy.test.ts` — segue `landing/copy.test.ts`: todas as seções presentes e nenhuma string vazia (o
tipo garante a forma, mas não pega `""`).

Baseline atual da worktree: **191 testes** (151 web + 40 server), todos verdes.

## Fora de escopo

- **MFA.** Exige plano Pro do Clerk ($25/mo) em produção; decidido adiar. Grátis em instância de
  desenvolvimento, então dá pra construir depois sem pagar antes.
- **Onboarding multi-passo** no `/signup` (nome, fuso confirmado, primeira tarefa). Foi considerado
  e recusado: joga onboarding pra dentro de um passe de auth.
- **O locale `en` em si.** Nenhum dicionário `en` é escrito aqui — só o `export type AuthCopy` que
  um futuro locale vai cumprir. `Dailify-17s` e `Dailify-1xy` seguem abertas.
- **Reestruturar `/profile`** e o passe visual do `/premium`. Já eram follow-ups do redesign do
  dashboard.
- **Nome e sobrenome.** Discutido e descartado: não são consumidos em lugar nenhum do app (só o
  avatar de 24px em `app-header.tsx:91`, que vem do OAuth), e o Stripe Checkout coleta o nome do
  cartão sozinho.
