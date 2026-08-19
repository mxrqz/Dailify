# Páginas de conta: uma rota por item da sidebar

**Data:** 2026-08-18
**Branch:** `worktree-account-pages`

## Problema

Três problemas independentes que se resolvem no mesmo lugar.

**1. A página Premium é uma tela em branco pra todo usuário Free.**

A cadeia, verificada no código:

| passo | arquivo | comportamento |
|---|---|---|
| server | `apps/server/src/routes/billing.ts:80` | sem `stripeCustomerId` → **400** "No Stripe customer" |
| client | `apps/web/src/functions/api.ts:72` | `!res.ok` → devolve `null` |
| render | `apps/web/src/pages/profile.tsx:41` | `permissions && paymentDetails && invoices &&` → falsy |

Quem nunca assinou não tem `stripeCustomerId`, então `paymentDetails` é `null` e o gate único derruba a aba inteira — inclusive o bloco de consumo de tarefas, que vem de `permissions` e **não depende do Stripe**. O usuário Free clica em "Premium" na sidebar e vê nada.

**2. As quatro seções de conta dividem uma rota só.**

`/profile?tab=personal|security|premium|settings`. Um query param decide qual componente monta. A sidebar mantém `useActiveSection()` só pra decodificar esse param de volta, e `profileTabs.tsx` acumulou 1080 linhas servindo três seções que não se falam.

**3. 543 linhas de código morto.**

Cinco arquivos sem nenhuma referência no projeto.

## Decisões tomadas

| decisão | escolha | alternativa recusada |
|---|---|---|
| Nomes de rota | inglês top-level; `/billing` pra assinatura | pt-BR (`/assinatura`); aninhar sob `/account` |
| `/premium` | continua sendo a página **pública de planos**, intocada | virar a página de assinatura |
| Free em `/billing` | consumo + estado vazio + CTA pros planos | redirecionar Free pra `/premium` |
| `profileTabs.tsx` | quebrado, um arquivo por página, deletado | manter e só separar rotas |
| PersonalTab (680 linhas) | vira página, **não** é fatiada | fatiar em componentes |

## Arquitetura

### Rotas — `apps/web/src/App.tsx`

Todas dentro do `<Route element={<AppLayout />}>` que já existe.

```
/dashboard   ProtectedRoute › Home           (inalterada)
/profile     ProtectedRoute › ProfilePage    ← ex-PersonalTab
/security    ProtectedRoute › SecurityPage   ← ex-SecurityTab
/billing     ProtectedRoute › BillingPage    ← ex-SubscriptionTab
/settings    ProtectedRoute › SettingsPage   ← ex-card inline
/premium     PremiumPage                     (pública, inalterada)
```

`/premium` fica **fora** do `ProtectedRoute` como já está hoje — é a página de venda, precisa abrir deslogado. É por isso que o `AppHeader` mantém o botão "Entrar" e a sidebar condiciona "Sair" a `isSignedIn`.

Cada rota leva o próprio `<Helmet><title>`, como as duas existentes já fazem.

Os destinos dos botões da sidebar mudam junto:

| botão | de | para |
|---|---|---|
| `ProfileButton` | `/profile?tab=personal` | `/profile` |
| `SecurityButton` | `/profile?tab=security` | `/security` |
| `PremiumButton` | `/profile?tab=premium` | `/billing` |
| `SettingsButton` | `/profile?tab=settings` | `/settings` |
| `DashboardButton` | `/dashboard` | inalterado |

### Arquivos

| novo | origem | ~linhas |
|---|---|---|
| `pages/profile.tsx` | `profileTabs.tsx:398` (PersonalTab) | 680 |
| `pages/security.tsx` | `profileTabs.tsx:274` (SecurityTab) | 120 |
| `pages/billing.tsx` | `profileTabs.tsx:113` (SubscriptionTab) + estados vazios | 200 |
| `pages/settings.tsx` | card inline de `profile.tsx` | 40 |
| `components/page-header.tsx` | inline em `profile.tsx:26` | 15 |
| `functions/billing-sections.ts` | novo | 15 |

**`components/profileTabs.tsx` é deletado.**

O corte é limpo: nenhum helper cruza fronteira entre as tabs. `getFlagEmoji` e `countries` só aparecem da linha 489 em diante (PersonalTab); `planMap`, `computeEntitlements` e `billingPortal` só na Subscription. Cada página leva os próprios imports — **não** se cria um módulo de helpers compartilhados.

### A sidebar encolhe

`useActiveSection()`, o tipo `SidebarSection` e a prop `active` dos cinco botões existem só pra traduzir `?tab=` em "qual item acende". Com uma rota por página, `SidebarItem` resolve sozinho comparando `useLocation().pathname` com o próprio `to`.

Removidos: o hook, o tipo, e a prop `active` de `DashboardButton`, `ProfileButton`, `SecurityButton`, `PremiumButton`, `SettingsButton`.

Uma exceção sobrevive: `/premium` (planos) deve acender "Premium", que aponta pra `/billing`. `SidebarItem` ganha `alsoActive?: string`, usado só pelo `PremiumButton`.

> O destaque marca o **assunto**, não o destino: estando em `/premium`, clicar no item aceso leva pra `/billing`, que é outra página. Comportamento decidido deliberadamente (commit `201a7a5`), não acidente.

### `/billing` — o conteúdo

O gate único vira um gate por bloco:

| bloco | condição | fallback |
|---|---|---|
| Consumo de tarefas | sempre — só usa `permissions` | — |
| Assinatura | `paymentDetails` presente | "Sem assinatura ativa" + botão → `/premium` |
| Faturas | `invoices` não vazio | "Sem faturas ainda" |

A decisão sai do JSX pra uma função pura em `functions/billing-sections.ts`:

```ts
export function billingSections(
  paymentDetails: PaymentDetailsProps | null | undefined,
  invoices: InvoicesProps[] | undefined,
): { subscription: boolean; invoices: boolean };
```

**Ela existe pelo teste, não pela abstração.** O bug era exatamente um gate errado; o teste fixa que o par `(null, [])` — o usuário Free — não derruba a página. Sem ele, nada impede alguém de reintroduzir o `&& paymentDetails`.

### `copy.ts`

Em `copy.profile`: título de cada uma das quatro páginas, mais `billingNoSubscription`, `billingSeePlans` e `billingNoInvoices`.

## Dead code

Cinco arquivos, zero referências — verificado por basename em qualquer forma de import **e** pelo nome do símbolo exportado:

| arquivo | linhas | o que é |
|---|---|---|
| `components/profile-config.tsx` | 203 | duplicata morta do editor de perfil que vive em `profileTabs.tsx` |
| `components/new-task.tsx` | 128 | substituído pelo `task-composer.tsx` |
| `components/ui/calendar3.tsx` | 104 | substituído pelo `mini-calendar.tsx` |
| `components/new-task-voice.tsx` | 74 | substituído pelo `wave-form.tsx` + composer |
| `components/ui/textarea.tsx` | 34 | primitivo shadcn nunca usado |

Nenhuma dependência do `package.json` fica órfã: os imports desses arquivos (`date-fns`, `sonner`, `lucide-react`, `@clerk/clerk-react`, `react-router-dom`, `@dailify/shared`) são todos usados em outros lugares.

`main.tsx` e `vite-env.d.ts` também aparecem sem importadores e **não** são dead code — entrypoint do `index.html` e declaração de ambiente.

## Fora de escopo

- **Redirects de `/profile?tab=X` pras rotas novas.** `/profile` continua existindo (vira a página de perfil), então o link antigo degrada em vez de quebrar. ~10 linhas se for pedido.
- **Fatiar a PersonalTab de 680 linhas.** Decisão explícita.
- **Navegação mobile (`Dailify-0fd`).** Continua aberta e piora de grau: passam a ser quatro rotas inalcançáveis abaixo de `md`, não quatro tabs.

## Verificação

- `bun run check` — format + lint + typecheck + testes (420 na base).
- Um teste novo: `functions/billing-sections.test.ts`, cobrindo Free `(null, [])`, assinante `(detalhes, [faturas])` e o meio-termo `(detalhes, [])`.
- Sem RTL/jsdom no projeto, então render não é testável automaticamente. `/premium` eu confirmo por screenshot com chromium headless; **`/billing`, `/profile`, `/security` e `/settings` exigem login e precisam de verificação humana.**
