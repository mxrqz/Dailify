# Páginas de Conta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada item da sidebar sua própria rota, e fazer a página Premium parar de renderizar em branco pra usuário Free.

**Architecture:** As quatro seções que hoje dividem `/profile?tab=X` viram quatro rotas top-level (`/profile`, `/security`, `/billing`, `/settings`) dentro do `AppLayout` que já existe. O `profileTabs.tsx` de 1080 linhas é dividido, uma página por seção, e deletado. A sidebar perde o `useActiveSection()` — com uma rota por página, cada item compara o próprio `to` com o `pathname`. O gate único que escondia `/billing` inteira vira um gate por bloco, decidido por uma função pura testada.

**Tech Stack:** React 18 + Vite + TypeScript · react-router-dom · Tailwind v4 + shadcn/ui · Clerk · vitest · bun

**Spec:** `docs/superpowers/specs/2026-08-18-account-pages-design.md`

## Global Constraints

- **Sem `as`.** `@typescript-eslint/consistent-type-assertions: never` (warning). Use type guards. `as const` é permitido.
- **Prettier**, `printWidth: 100`. `bun run format` antes de commitar.
- **Tokens de design**, nunca hex ou cor arbitrária. As páginas usam `border-surface-line`, `bg-surface-card`, `text-content-secondary` — copie das existentes.
- **Copy em pt-BR** vive em `apps/web/src/components/dashboard/copy.ts`. Nenhuma string literal pt-BR nova em componente.
- **Comentários:** só o não-óbvio, uma linha explicando **por quê**. Nada de docblock narrando o que o código já diz.
- **`noUnusedLocals: true`** no tsconfig: import órfão é **erro de typecheck**, não warning. É a rede de segurança de toda movimentação de bloco neste plano.
- **Gate:** `bun run check` (format:check + lint + typecheck + test). Baseline **420 testes**. Lint tem **13 warnings pré-existentes** de `react-hooks/exhaustive-deps` — não são regressão, não tente consertar.
- **`bun run lint` NÃO existe na raiz.** A raiz só tem `dev`, `build`, `test`, `check` — o `CLAUDE.md` do projeto está errado nesse ponto. Para rodar lint isolado: `bun --filter '@dailify/web' lint`. O mesmo vale pra `typecheck` e `format`. Rodar o nome errado falha com `Script not found`, e um `| grep` na frente engole o erro e faz parecer sucesso.
- **Não existe rota catch-all.** Path inexistente = página em branco (`pages/CLAUDE.md`). Toda rota nova precisa estar declarada em `App.tsx` antes de qualquer link apontar pra ela.

---

### Task 1: `billingSections` — a função que conserta a tela em branco

**Files:**
- Create: `apps/web/src/functions/billing-sections.ts`
- Test: `apps/web/src/functions/billing-sections.test.ts`

**Interfaces:**
- Consumes: `PaymentDetails` e `Invoice` de `@dailify/shared` (re-exportados por `@/types/types` como `PaymentDetailsProps` / `InvoicesProps`).
- Produces: `billingSections(paymentDetails, invoices) => { subscription: boolean; invoices: boolean }` — consumido pela Task 5.

Shapes reais, pros fixtures:

```ts
interface PaymentDetails { amount: number; currency: string; start: number; recurring: "year" | "month" }
interface Invoice {
  amount_paid: number; currency: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void" | null;
  created: number; hosted_invoice_url: string | null | undefined; recurring: "year" | "month";
  brandName?: string; cardLast4?: string; walletType?: string; paymentMethodType?: string;
}
```

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/functions/billing-sections.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { InvoicesProps, PaymentDetailsProps } from "@/types/types";
import { billingSections } from "./billing-sections";

const subscription: PaymentDetailsProps = {
  amount: 990,
  currency: "brl",
  start: 1_755_000_000,
  recurring: "month",
};

const invoice: InvoicesProps = {
  amount_paid: 990,
  currency: "brl",
  status: "paid",
  created: 1_755_000_000,
  hosted_invoice_url: "https://invoice.stripe.com/x",
  recurring: "month",
};

describe("billingSections", () => {
  // O bug que motivou tudo: o server responde 400 pra quem não tem stripeCustomerId, o client
  // devolve null, e o gate antigo (`permissions && paymentDetails && invoices`) apagava a página
  // inteira — inclusive o consumo de tarefas, que não vem do Stripe.
  it("Free sem Stripe: esconde assinatura e faturas", () => {
    expect(billingSections(null, [])).toEqual({ subscription: false, invoices: false });
  });

  it("ainda carregando (undefined): esconde os dois", () => {
    expect(billingSections(undefined, undefined)).toEqual({
      subscription: false,
      invoices: false,
    });
  });

  it("assinante com histórico: mostra os dois", () => {
    expect(billingSections(subscription, [invoice])).toEqual({
      subscription: true,
      invoices: true,
    });
  });

  it("assinante recém-convertido: assinatura sim, faturas ainda não", () => {
    expect(billingSections(subscription, [])).toEqual({ subscription: true, invoices: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter '@dailify/web' test -- billing-sections`
Expected: FAIL — `Failed to resolve import "./billing-sections"`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/functions/billing-sections.ts`:

```ts
import type { InvoicesProps, PaymentDetailsProps } from "@/types/types";

/**
 * Quais blocos de `/billing` têm o que mostrar. Mora fora do JSX por causa do bug que ela substitui:
 * um gate único `permissions && paymentDetails && invoices` derrubava a página toda pra quem é Free,
 * levando junto o consumo de tarefas — que vem de `permissions` e não depende do Stripe.
 */
export function billingSections(
  paymentDetails: PaymentDetailsProps | null | undefined,
  invoices: InvoicesProps[] | undefined,
): { subscription: boolean; invoices: boolean } {
  return {
    subscription: Boolean(paymentDetails),
    invoices: (invoices?.length ?? 0) > 0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter '@dailify/web' test -- billing-sections`
Expected: PASS, 4 testes.

- [ ] **Step 5: Full gate + commit**

```bash
bun run format
bun run check   # 424 testes agora (420 + 4)
git add apps/web/src/functions/billing-sections.ts apps/web/src/functions/billing-sections.test.ts
git commit -m "feat(web): billingSections decide quais blocos de /billing tem dados"
```

---

### Task 2: `PageHeader`

**Files:**
- Create: `apps/web/src/components/page-header.tsx`

**Interfaces:**
- Produces: `<PageHeader title={string} />` — usado pelas Tasks 3, 4, 5 e 6.

Extraído de `apps/web/src/pages/profile.tsx:26-32`, sem mudar comportamento: o botão volta pro `/dashboard`.

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/page-header.tsx`:

```tsx
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";

export function PageHeader({ title }: { title: string }): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">{copy.profile.back}</span>
      </Button>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `bun run check`
Expected: PASS, 424 testes. (Ninguém importa `PageHeader` ainda — `noUnusedLocals` reclama de *locais* não usados, não de exports.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/page-header.tsx
git commit -m "refactor(web): extrai PageHeader do profile.tsx"
```

---

### Task 3: `/settings`

A menor das quatro — estabelece o padrão que as Tasks 4, 5 e 6 repetem.

**Files:**
- Create: `apps/web/src/pages/settings.tsx`
- Modify: `apps/web/src/App.tsx` (nova rota)
- Modify: `apps/web/src/components/dashboard/sidebar/settings-button.tsx` (o `to`)
- Modify: `apps/web/src/components/dashboard/sidebar/index.tsx` (`useActiveSection`)
- Modify: `apps/web/src/components/dashboard/copy.ts` (título da página)
- Modify: `apps/web/src/pages/profile.tsx` (remove o bloco `settings`)

**Interfaces:**
- Consumes: `PageHeader` (Task 2), `ThemeSelect` de `@/components/mode-toggle`.
- Produces: rota `/settings`.

> **Nota sobre estado intermediário:** entre esta task e a Task 7, `useActiveSection()` ganha `if` por rota nova. É andaime — a Task 7 apaga a função inteira. Não tente embelezar.

- [ ] **Step 1: Add the page title to copy**

Modify `apps/web/src/components/dashboard/copy.ts`, dentro de `profile:`, logo após `pageTitle`:

```ts
    settingsPageTitle: "Configurações",
    securityPageTitle: "Segurança",
    billingPageTitle: "Premium",
```

(As três de uma vez — as Tasks 4 e 5 usam as outras duas.)

- [ ] **Step 2: Create the page**

Create `apps/web/src/pages/settings.tsx`. O conteúdo dos dois Cards sai de `pages/profile.tsx:47-77` (os dois blocos `active === "settings"`), sem alteração:

```tsx
import { copy } from "@/components/dashboard/copy";
import { ThemeSelect } from "@/components/mode-toggle";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage(): JSX.Element {
  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <PageHeader title={copy.profile.settingsPageTitle} />

      <div className="flex flex-col gap-6">
        <Card className="rounded-2xl border-surface-line bg-surface-card">
          <CardHeader>
            <CardTitle>{copy.profile.themeTitle}</CardTitle>
            <CardDescription className="text-content-secondary">
              {copy.profile.themeDescription}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ThemeSelect />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-surface-line bg-surface-card">
          <CardHeader>
            <CardTitle>{copy.profile.notificationsTitle}</CardTitle>
            <CardDescription className="text-content-secondary">
              {copy.profile.notificationsDescription}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-sm text-content-secondary">{copy.profile.notificationsSoon}</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Register the route**

Modify `apps/web/src/App.tsx`. Adicione o import junto dos outros de página, e a rota **dentro** do `<Route element={<AppLayout />}>`, seguindo exatamente o formato da rota `/profile` que já está lá:

```tsx
import SettingsPage from "./pages/settings";
```

```tsx
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Helmet>
                          <title>Dailify - Configurações</title>
                        </Helmet>

                        <SettingsPage />
                      </ProtectedRoute>
                    }
                  />
```

- [ ] **Step 4: Point the sidebar button at it**

Modify `apps/web/src/components/dashboard/sidebar/settings-button.tsx`: troque `to="/profile?tab=settings"` por `to="/settings"`.

- [ ] **Step 5: Teach `useActiveSection` the new route**

Modify `apps/web/src/components/dashboard/sidebar/index.tsx`, dentro de `useActiveSection`, antes do `if (pathname !== "/profile")`:

```ts
  if (pathname === "/settings") return "settings";
```

- [ ] **Step 6: Remove the settings blocks from profile.tsx**

Modify `apps/web/src/pages/profile.tsx`: apague os **dois** blocos `{active === "settings" && ( ... )}` (linhas 47-77). Remova `"settings"` do type `Section` e do array `SECTIONS`. Rode o typecheck — `noUnusedLocals` vai apontar os imports que sobraram (`ThemeSelect`, e possivelmente `Card`/`CardContent`/`CardDescription`/`CardHeader`/`CardTitle` se nenhum outro bloco usar). Remova exatamente os que ele apontar.

- [ ] **Step 7: Verify**

```bash
bun run format
bun run check
```
Expected: PASS, 424 testes, 13 warnings pré-existentes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(web): Configuracoes vira /settings"
```

---

### Task 4: `/security`

**Files:**
- Create: `apps/web/src/pages/security.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/dashboard/sidebar/security-button.tsx`
- Modify: `apps/web/src/components/dashboard/sidebar/index.tsx`
- Modify: `apps/web/src/components/profileTabs.tsx` (remove `SecurityTab`)
- Modify: `apps/web/src/pages/profile.tsx` (remove o bloco `security`)

**Interfaces:**
- Consumes: `PageHeader` (Task 2).
- Produces: rota `/security`.

- [ ] **Step 1: Move the component**

Recorte `profileTabs.tsx:274-396` — a função `SecurityTab()` inteira, do `export function SecurityTab() {` até o `}` que a fecha, imediatamente antes de `export function PersonalTab()`.

Create `apps/web/src/pages/security.tsx` com esta casca, colando o **corpo** da `SecurityTab` (tudo dentro dela) no lugar indicado:

```tsx
import { useUser, useSession } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import type { SessionWithActivitiesResource } from "@clerk/types";
import { formatRelative } from "date-fns";
import { EllipsisVerticalIcon, Laptop2Icon, Smartphone } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function SecurityPage(): JSX.Element {
  // ↓↓↓ corpo da antiga SecurityTab: hooks, getSessions, useEffect ↓↓↓

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <PageHeader title={copy.profile.securityPageTitle} />

      <div className="flex flex-col gap-6">
        {/* ↓↓↓ o <Card>...</Card> que a SecurityTab retornava, sem alteração ↓↓↓ */}
      </div>
    </main>
  );
}
```

A lista de imports acima é o palpite inicial. **Não confie nela** — rode o Step 3 e deixe o typecheck decidir: `noUnusedLocals` aponta o que sobrou, e "Cannot find name" aponta o que falta.

- [ ] **Step 2: Delete `SecurityTab` from profileTabs.tsx**

Apague as linhas 274-396 de `apps/web/src/components/profileTabs.tsx`.

- [ ] **Step 3: Let the typechecker clean the imports**

Run: `bun --filter '@dailify/web' typecheck`

Em `pages/security.tsx`: remova todo import que ele reportar como não usado; adicione todo símbolo que ele reportar como não encontrado.
Em `components/profileTabs.tsx`: mesma coisa — a saída da `SecurityTab` provavelmente deixou `useSession`, `SessionWithActivitiesResource`, `formatRelative`, `EllipsisVerticalIcon`, `Laptop2Icon`, `Smartphone` e `Popover*` órfãos. Remova os que ele apontar, e **só** os que ele apontar.

Repita até sair limpo.

- [ ] **Step 4: Register the route**

Modify `apps/web/src/App.tsx`:

```tsx
import SecurityPage from "./pages/security";
```

```tsx
                  <Route
                    path="/security"
                    element={
                      <ProtectedRoute>
                        <Helmet>
                          <title>Dailify - Segurança</title>
                        </Helmet>

                        <SecurityPage />
                      </ProtectedRoute>
                    }
                  />
```

- [ ] **Step 5: Point the sidebar button at it**

Modify `security-button.tsx`: `to="/profile?tab=security"` → `to="/security"`.

- [ ] **Step 6: Teach `useActiveSection`**

Em `sidebar/index.tsx`, junto do `if` da Task 3:

```ts
  if (pathname === "/security") return "security";
```

- [ ] **Step 7: Remove the security block from profile.tsx**

Apague `{active === "security" && <SecurityTab />}`. Tire `"security"` do type `Section` e de `SECTIONS`. Ajuste o import de `profileTabs`.

- [ ] **Step 8: Verify + commit**

```bash
bun run format
bun run check   # 424 testes
git add -A
git commit -m "refactor(web): Seguranca vira /security"
```

---

### Task 5: `/billing` — a página que estava em branco

Esta é a que resolve o pedido original. Além de mover, muda comportamento.

**Files:**
- Create: `apps/web/src/pages/billing.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/dashboard/sidebar/premium-button.tsx`
- Modify: `apps/web/src/components/dashboard/sidebar/index.tsx`
- Modify: `apps/web/src/components/dashboard/copy.ts`
- Modify: `apps/web/src/components/profileTabs.tsx` (remove `SubscriptionTab`)
- Modify: `apps/web/src/pages/profile.tsx` (remove o bloco `premium`)

**Interfaces:**
- Consumes: `billingSections` (Task 1), `PageHeader` (Task 2), `useDailify()` de `@/components/dailifyContext`.
- Produces: rota `/billing`.

A diferença central: a `SubscriptionTab` recebia `paymentDetails`, `permissions` e `invoices` **por prop**, e quem montava (`profile.tsx:39`) só montava se os três fossem truthy. A página nova lê do `useDailify()` direto e decide bloco a bloco.

- [ ] **Step 1: Add the empty-state copy**

Modify `copy.ts`, em `profile:`:

```ts
    billingNoSubscription: "Você está no plano Free. Nenhuma assinatura ativa.",
    billingSeePlans: "Ver planos",
    billingNoInvoices: "Nenhuma fatura ainda.",
```

- [ ] **Step 2: Create the page**

Create `apps/web/src/pages/billing.tsx`. Estrutura abaixo; os três blocos internos (consumo, assinatura, faturas) saem de `profileTabs.tsx:113-272` sem alteração de aparência.

```tsx
import { useAuth, useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { billingSections } from "@/functions/billing-sections";

export default function BillingPage(): JSX.Element {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { tasks, invoices, permissions, paymentDetails } = useDailify();

  const sections = billingSections(paymentDetails, invoices);

  // ↓ resto dos hooks/helpers da antiga SubscriptionTab: plan, tasksUsed, entitlements,
  //   brandIcons, walletIcons, amountFormatted, getBillingPortalUrl ↓

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <PageHeader title={copy.profile.billingPageTitle} />

      <Card className="rounded-2xl border-surface-line bg-surface-card">
        <CardHeader>
          <CardTitle>Plano e Assinatura</CardTitle>
          <CardDescription className="text-content-secondary">
            Gerencie seu plano atual e informações de pagamento.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* BLOCO 1 — consumo: sempre renderiza. Só depende de `permissions`. */}
          {/* Cole aqui o <div className="rounded-lg border p-4"> da SubscriptionTab, MAS: */}
          {/*   - o cabeçalho "Próxima cobrança…" + botão "Gerenciar plano" só se sections.subscription */}
          {/*   - a barra de progresso de tarefas fica fora de qualquer condicional */}

          {!sections.subscription && (
            <div className="rounded-lg border border-surface-line p-4">
              <p className="text-sm text-content-secondary">
                {copy.profile.billingNoSubscription}
              </p>
              <Button asChild variant="outline" className="mt-3">
                <Link to="/premium">{copy.profile.billingSeePlans}</Link>
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Histórico de pagamentos</h3>

            {sections.invoices ? (
              <div className="space-y-4">{/* o .sort().map() de faturas, sem alteração */}</div>
            ) : (
              <p className="text-sm text-content-secondary">{copy.profile.billingNoInvoices}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
```

**O ponto que não pode ser errado:** a barra de progresso de tarefas usadas fica **fora** de qualquer condicional ligada a `paymentDetails` ou `invoices`. Ela vem de `permissions` via `computeEntitlements` e é a informação que o Free perdia.

- [ ] **Step 3: Delete `SubscriptionTab` from profileTabs.tsx**

Apague as linhas 113-272.

- [ ] **Step 4: Let the typechecker clean the imports**

Run: `bun --filter '@dailify/web' typecheck`

Em `profileTabs.tsx`, devem ficar órfãos: `planMap`, `computeEntitlements`, `billingPortal`, `Progress`, `Separator`, `Badge`, `CreditCard`, `Receipt`, `format`, os ícones de `react-icons`, `ApplePayLogo`, `GooglePayLogo`, `useDailify`, `CardFooter`. Remova os que ele apontar.

Repita até limpo.

- [ ] **Step 5: Route + sidebar + profile.tsx**

`App.tsx`:

```tsx
import BillingPage from "./pages/billing";
```

```tsx
                  <Route
                    path="/billing"
                    element={
                      <ProtectedRoute>
                        <Helmet>
                          <title>Dailify - Premium</title>
                        </Helmet>

                        <BillingPage />
                      </ProtectedRoute>
                    }
                  />
```

`premium-button.tsx`: `to="/profile?tab=premium"` → `to="/billing"`.

`sidebar/index.tsx`, junto dos outros `if`:

```ts
  if (pathname === "/billing" || pathname === "/premium") return "premium";
```

(O `/premium` aqui preserva a decisão do commit `201a7a5` — a página de planos acende o item Premium. A Task 7 move isso pro `alsoActive`.)

`pages/profile.tsx`: apague o bloco `{active === "premium" && ...}` inteiro, tire `"premium"` do `Section`/`SECTIONS`, e remova o `useDailify()` se nada mais o usar (o typecheck avisa).

- [ ] **Step 6: Verify + commit**

```bash
bun run format
bun run check   # 424 testes
git add -A
git commit -m "feat(web): /billing mostra consumo e estado vazio em vez de tela em branco no Free"
```

- [ ] **Step 7: Flag for human verification**

`/billing` exige login — não é verificável por chromium headless nem por teste. Anote no relatório que ela precisa de conferência visual humana, em **duas** contas: uma Free (deve ver consumo + "Ver planos") e uma assinante (deve ver tudo).

---

### Task 6: `/profile` vira só a Personal, e `profileTabs.tsx` morre

**Files:**
- Modify: `apps/web/src/pages/profile.tsx` (reescrita)
- Modify: `apps/web/src/components/dashboard/sidebar/profile-button.tsx`
- Delete: `apps/web/src/components/profileTabs.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 2).
- Produces: `/profile` renderizando a antiga `PersonalTab`.

Depois das Tasks 4 e 5, `profileTabs.tsx` contém só o bloco de imports, os helpers de topo (`countries`, `getFlagEmoji`, `countriesLib.registerLocale`) e a `PersonalTab`. Tudo isso é dela — nada é compartilhado, já verificado.

- [ ] **Step 1: Rewrite profile.tsx**

Substitua o conteúdo inteiro de `apps/web/src/pages/profile.tsx` por: o bloco de imports que sobrou em `profileTabs.tsx`, mais os helpers de topo, mais a `PersonalTab` renomeada pra `ProfilePage` com `export default`, embrulhada na casca padrão:

```tsx
export default function ProfilePage(): JSX.Element {
  // corpo da antiga PersonalTab, sem alteração

  return (
    <main className="flex w-full flex-col gap-6 py-6">
      <PageHeader title={copy.profile.pageTitle} />

      <div className="flex flex-col gap-6">
        {/* o que a PersonalTab retornava */}
      </div>
    </main>
  );
}
```

Cuidado: a `PersonalTab` usa `useSearchParams` pra ler `?addPhone` (`profileTabs.tsx:534` e `:552`). Esse comportamento **fica** — é um param funcional, não a navegação por tab.

- [ ] **Step 2: Delete profileTabs.tsx**

```bash
git rm apps/web/src/components/profileTabs.tsx
```

- [ ] **Step 3: Point the sidebar button at it**

`profile-button.tsx`: `to="/profile?tab=personal"` → `to="/profile"`.

- [ ] **Step 4: Typecheck until clean**

Run: `bun --filter '@dailify/web' typecheck`
Expected: nenhuma referência sobrando a `profileTabs`, nenhum import órfão.

- [ ] **Step 5: Verify + commit**

```bash
bun run format
bun run check   # 424 testes
git add -A
git commit -m "refactor(web): PersonalTab vira a propria /profile e profileTabs.tsx morre"
```

---

### Task 7: A sidebar perde o `useActiveSection`

Só agora, com as quatro rotas de pé, o andaime sai.

**Files:**
- Modify: `apps/web/src/components/dashboard/sidebar/sidebar-item.tsx`
- Modify: `apps/web/src/components/dashboard/sidebar/index.tsx`
- Modify: os cinco botões: `dashboard-button.tsx`, `profile-button.tsx`, `security-button.tsx`, `premium-button.tsx`, `settings-button.tsx`

**Interfaces:**
- Produces: `SidebarItem` sem prop `active`; `SidebarItemProps` e `SidebarSection` deixam de existir.

- [ ] **Step 1: Make `SidebarItem` resolve its own active state**

Modify `sidebar-item.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

/**
 * A aparência de um item da sidebar, separada do `<Link>` porque "Sair" é ação, não destino, e
 * precisa das mesmas classes num `<button>`.
 */
export function sidebarItemClass(active: boolean): string {
  return cn(
    "inline-flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
    active
      ? "bg-surface-hover text-foreground"
      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  );
}

/**
 * Um destino da sidebar. Cada um vive no próprio arquivo desta pasta e só preenche ícone, rótulo e
 * rota — o aceso sai da URL, aqui mesmo.
 *
 * `alsoActive` existe pra um caso só: `/premium` (escolher plano) acende "Premium", que aponta pra
 * `/billing` (gerenciar assinatura). O destaque marca o assunto, não o destino.
 */
export function SidebarItem({
  icon: Icon,
  label,
  to,
  alsoActive,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
  alsoActive?: string;
}): JSX.Element {
  const { pathname } = useLocation();
  const active = pathname === to || pathname === alsoActive;

  return (
    <Link to={to} aria-current={active ? "page" : undefined} className={sidebarItemClass(active)}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
```

- [ ] **Step 2: Simplify the five buttons**

Cada um perde `props`/`SidebarItemProps`. Exemplo completo, `settings-button.tsx`:

```tsx
import { SettingsIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { SidebarItem } from "./sidebar-item";

export function SettingsButton(): JSX.Element {
  return <SidebarItem icon={SettingsIcon} label={copy.profile.navSettings} to="/settings" />;
}
```

Mesma forma pros outros quatro:
- `dashboard-button.tsx` — `LayoutListIcon`, `copy.profile.navDashboard`, `to="/dashboard"`
- `profile-button.tsx` — `UserIcon`, `copy.profile.navPersonal`, `to="/profile"`
- `security-button.tsx` — `ShieldIcon`, `copy.profile.navSecurity`, `to="/security"`
- `premium-button.tsx` — `CrownIcon`, `copy.profile.navPremium`, `to="/billing"`, **mais** `alsoActive="/premium"`

- [ ] **Step 3: Gut `sidebar/index.tsx`**

Apague `useActiveSection()` inteira, o `export type { SidebarSection }`, o import de `SidebarSection`, e os imports `useLocation`/`useSearchParams`. Os cinco botões passam a ser chamados sem props:

```tsx
      <DashboardButton />
      <ProfileButton />
      <SecurityButton />
      <PremiumButton />
      <SettingsButton />
```

O bloco do `SignOutButton` com `isSignedIn` fica como está.

- [ ] **Step 4: Verify + commit**

```bash
bun run format
bun run check   # 424 testes
git add -A
git commit -m "refactor(web): item aceso da sidebar sai da URL, useActiveSection morre"
```

---

### Task 8: Dead code

**Files:**
- Delete: `apps/web/src/components/profile-config.tsx` (203)
- Delete: `apps/web/src/components/new-task.tsx` (128)
- Delete: `apps/web/src/components/ui/calendar3.tsx` (104)
- Delete: `apps/web/src/components/new-task-voice.tsx` (74)
- Delete: `apps/web/src/components/ui/textarea.tsx` (34)

Zero referências, verificado por caminho de import **e** por nome de símbolo exportado. Nenhuma dependência do `package.json` fica órfã.

- [ ] **Step 1: Re-verify before deleting**

Deleção é irreversível fora do git. Confirme que nada mudou desde o levantamento:

```bash
cd apps/web/src
for n in ProfileConfig NewTask NewTaskVoice Calendar3 Textarea; do
  echo "--- $n:"
  grep -rn --include="*.tsx" --include="*.ts" "\b$n\b" . \
    | grep -v "components/new-task.tsx\|components/new-task-voice.tsx\|components/profile-config.tsx\|components/ui/calendar3.tsx\|components/ui/textarea.tsx"
done
```

Expected: nenhuma linha sob nenhum dos cinco. **Se algum aparecer, pare e reporte** — não delete.

- [ ] **Step 2: Delete**

```bash
git rm apps/web/src/components/profile-config.tsx \
       apps/web/src/components/new-task.tsx \
       apps/web/src/components/ui/calendar3.tsx \
       apps/web/src/components/new-task-voice.tsx \
       apps/web/src/components/ui/textarea.tsx
```

- [ ] **Step 3: Verify**

```bash
bun run check
```

Expected: PASS, 424 testes, e os warnings de lint caem de 13 pra **11**. Dois dos treze moravam em arquivos deletados aqui, ambos `react-hooks/exhaustive-deps`:

| arquivo | linha |
|---|---|
| `components/new-task-voice.tsx` | 40 |
| `components/ui/calendar3.tsx` | 52 |

Mais que 11 é regressão — investigue antes de commitar.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(web): remove 543 linhas de codigo morto"
```

---

### Task 9: Atualizar a documentação de rotas

`apps/web/src/pages/CLAUDE.md` tem a tabela de rotas e é carregada automaticamente por quem trabalhar nesta pasta. Sair desatualizada é pior que não existir.

**Files:**
- Modify: `apps/web/src/pages/CLAUDE.md`

- [ ] **Step 1: Update the route table**

Troque a linha de `/profile` e acrescente as três novas:

```markdown
| `/profile`      | `profile.tsx`                 | **protected**; dados pessoais, foto, telefone, timezone                |
| `/security`     | `security.tsx`                | **protected**; sessões ativas e segurança da conta                     |
| `/billing`      | `billing.tsx`                 | **protected**; plano, consumo, faturas. Free vê consumo + CTA          |
| `/settings`     | `settings.tsx`                | **protected**; tema e (em breve) notificações                          |
```

- [ ] **Step 2: Update the billing paragraph**

Na seção `## Billing (premium.tsx)`, a última frase diz "The billing portal (`profileTabs.tsx`)". Esse arquivo não existe mais — troque por `pages/billing.tsx`.

- [ ] **Step 3: Fix the lint command in the root CLAUDE.md**

Modify `CLAUDE.md` (raiz). A seção `Build & Test` lista `bun run lint` e `bun run format`, que **não existem** na raiz — só `dev`, `build`, `test` e `check` são delegados. Quem seguir o doc leva `Script not found`. Troque as duas linhas por:

```
bun --filter '@dailify/web' lint     # eslint
bun --filter '@dailify/web' format   # prettier --write src
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/CLAUDE.md CLAUDE.md
git commit -m "docs: tabela de rotas nova e comandos de lint/format que existem de fato"
```

---

## Verificação final

- [ ] `bun run check` — 424 testes, 0 erros, **11 warnings** (13 da base menos os 2 que moravam em arquivos deletados).
- [ ] `grep -rn "profileTabs\|?tab=" apps/web/src` não devolve nada.
- [ ] Screenshot de `/premium` em ≥768px de largura confirmando que "Premium" acende (o único verificável sem login):
  ```bash
  chromium --headless --disable-gpu --no-sandbox --ignore-certificate-errors \
    --window-size=900,400 --virtual-time-budget=8000 \
    --screenshot=premium.png https://localhost:1420/premium
  ```
- [ ] **Verificação humana obrigatória** (exigem login, sem RTL no projeto): `/profile`, `/security`, `/settings`, e `/billing` em conta Free **e** em conta assinante.
