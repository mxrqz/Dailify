# Telas de auth — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar o sign-in-or-up implícito de `/login` em duas rotas (`/login` e `/signup`) com o mesmo motor de magic link + Google, no vocabulário visual da landing e do dashboard, com máquina de estados e erros visíveis.

**Architecture:** Um `AuthShell` compartilhado desenha marca, card e rodapé legal; `auth-state.ts` concentra toda a lógica pura (reducer, classificação de erro do Clerk, alvo de redirect, cooldown) e é o único arquivo testado; `use-email-link-auth.ts` é a casca fina que liga o Clerk ao reducer. As páginas `/login` e `/signup` são ~40 linhas de copy e wiring cada.

**Tech Stack:** React 18 + Vite + TypeScript, Clerk `@clerk/clerk-react` 5.61.3, react-router, Tailwind v4 + shadcn/ui, vitest 4 (node, sem jsdom). Package manager: **bun**.

**Spec:** `docs/superpowers/specs/2026-08-13-auth-pages-design.md`

**Issues bd:** `Dailify-5w6` (auth, P1 — Tasks 1-7) · `Dailify-9m7` (CTAs mortos do hero, P2 — Task 8) · `Dailify-8ii` (tema do sistema, P2 — Task 9)

## Global Constraints

- **Sem `as`.** Type assertions são warning do ESLint. Use type guards. `as const` é permitido.
- **Sem hex, sem cor arbitrária.** Só tokens de `global.css`: `surface-page`, `surface-card`, `surface-line`, `surface-hover`, `primary`, `destructive`, `muted-foreground`, `text-secondary`.
- **Nenhuma string visível dentro do JSX.** Tudo em `components/auth/copy.ts`. Único arquivo de copy, em pt-BR.
- **Prettier `printWidth: 100`.** Rode `bun run format` antes de cada commit.
- **Gate completo:** `bun run check` = prettier + eslint + tsc + vitest. Precisa passar antes de todo commit.
- **Baseline:** 213 testes verdes — 151 web + 40 server + 22 `packages/shared` (`pricing.test.ts`, `recurrence.test.ts`). Nenhum commit pode reduzir esse número.
- **`@/` resolve pra `apps/web/src/`.** Todos os comandos rodam da raiz da worktree.
- **Não adicionar dependências.** Especialmente não `@testing-library/react`, `jsdom` ou `@clerk/localizations`.
- **Radius:** `rounded-panel` (1.375rem) para o card. Botões e input ficam no `rounded-md` do shadcn.
- **Dado de máquina:** `font-mono text-2xs uppercase tracking-[0.04em]`.
- **Cooldown de reenvio:** 30 segundos (`RESEND_COOLDOWN_MS = 30_000`).
- **Espaçamentos fixos do layout:** logo a 40px acima do bloco (`mb-10`), rodapé a 20px do fundo (`bottom-5`), card `max-w-[380px]`.

---

### Task 1: `auth-state.ts` — a lógica pura

Toda a lógica que merece teste, fora do React. É a fundação: as tasks 4, 5 e 6 consomem isso.

**Files:**
- Create: `apps/web/src/components/auth/auth-state.ts`
- Test: `apps/web/src/components/auth/auth-state.test.ts`

**Interfaces:**
- Consumes: nada (primeira task)
- Produces: `AuthMode`, `AuthState`, `AuthAction`, `AuthFailure`, `AuthErrorKey`, `initialAuthState`, `authReducer(state, action)`, `classifyClerkError(code, mode)`, `redirectTarget(state)`, `canResend(sentAt, now)`, `RESEND_COOLDOWN_MS`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/src/components/auth/auth-state.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import {
  authReducer,
  canResend,
  classifyClerkError,
  initialAuthState,
  redirectTarget,
  RESEND_COOLDOWN_MS,
} from "./auth-state";

describe("authReducer", () => {
  it("submit sai de idle pra sending", () => {
    expect(authReducer(initialAuthState, { type: "submit" })).toEqual({ status: "sending" });
  });

  it("submit em sending não faz nada (evita disparo duplo)", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    expect(authReducer(sending, { type: "submit" })).toBe(sending);
  });

  it("linkSent só vale vindo de sending", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    expect(authReducer(sending, { type: "linkSent", email: "a@b.com", at: 1000 })).toEqual({
      status: "awaitingLink",
      email: "a@b.com",
      sentAt: 1000,
    });
    expect(authReducer(initialAuthState, { type: "linkSent", email: "a@b.com", at: 1000 })).toBe(
      initialAuthState,
    );
  });

  it("expired só vale vindo de awaitingLink, e preserva o e-mail", () => {
    const awaiting = authReducer(authReducer(initialAuthState, { type: "submit" }), {
      type: "linkSent",
      email: "a@b.com",
      at: 1000,
    });
    expect(authReducer(awaiting, { type: "expired" })).toEqual({
      status: "expired",
      email: "a@b.com",
    });
    expect(authReducer(initialAuthState, { type: "expired" })).toBe(initialAuthState);
  });

  it("failed com mensagem vira error", () => {
    expect(authReducer(initialAuthState, { type: "failed", failure: { kind: "message", key: "invalidEmail" } })).toEqual(
      { status: "error", failure: { kind: "message", key: "invalidEmail" } },
    );
  });

  it("failed com oferta guarda o modo oferecido", () => {
    expect(
      authReducer(initialAuthState, { type: "failed", failure: { kind: "offer", mode: "signUp" } }),
    ).toEqual({ status: "error", failure: { kind: "offer", mode: "signUp" } });
  });

  it("verified é terminal e alcançável de qualquer estado", () => {
    expect(authReducer(initialAuthState, { type: "verified" })).toEqual({ status: "verified" });
  });

  it("reset volta pra idle", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    expect(authReducer(sending, { type: "reset" })).toEqual(initialAuthState);
  });
});

describe("classifyClerkError", () => {
  it("no /login, e-mail desconhecido oferece o cadastro", () => {
    expect(classifyClerkError("form_identifier_not_found", "signIn")).toEqual({
      kind: "offer",
      mode: "signUp",
    });
  });

  it("no /signup, e-mail conhecido oferece o login", () => {
    expect(classifyClerkError("form_identifier_exists", "signUp")).toEqual({
      kind: "offer",
      mode: "signIn",
    });
  });

  it("e-mail desconhecido no /signup não é oferta — é erro genérico", () => {
    expect(classifyClerkError("form_identifier_not_found", "signUp")).toEqual({
      kind: "message",
      key: "generic",
      code: "form_identifier_not_found",
    });
  });

  it("mapeia formato inválido, e-mail descartável, captcha e rate limit", () => {
    expect(classifyClerkError("form_param_format_invalid", "signIn")).toEqual({
      kind: "message",
      key: "invalidEmail",
    });
    expect(classifyClerkError("form_email_address_blocked", "signUp")).toEqual({
      kind: "message",
      key: "blockedEmail",
    });
    expect(classifyClerkError("captcha_invalid", "signUp")).toEqual({
      kind: "message",
      key: "captcha",
    });
    expect(classifyClerkError("captcha_unavailable", "signUp")).toEqual({
      kind: "message",
      key: "captcha",
    });
    expect(classifyClerkError("too_many_requests", "signIn")).toEqual({
      kind: "message",
      key: "tooManyRequests",
    });
  });

  it("código desconhecido cai no genérico e carrega o code pro relato de bug", () => {
    expect(classifyClerkError("some_new_clerk_code", "signIn")).toEqual({
      kind: "message",
      key: "generic",
      code: "some_new_clerk_code",
    });
  });
});

describe("redirectTarget", () => {
  it("extrai pathname + search do state do ProtectedRoute", () => {
    expect(redirectTarget({ from: { pathname: "/profile", search: "?tab=premium" } })).toBe(
      "/profile?tab=premium",
    );
  });

  it("aceita pathname sem search", () => {
    expect(redirectTarget({ from: { pathname: "/profile", search: "" } })).toBe("/profile");
  });

  it("cai em /dashboard pra todo formato inesperado", () => {
    expect(redirectTarget(null)).toBe("/dashboard");
    expect(redirectTarget(undefined)).toBe("/dashboard");
    expect(redirectTarget("string")).toBe("/dashboard");
    expect(redirectTarget({})).toBe("/dashboard");
    expect(redirectTarget({ from: null })).toBe("/dashboard");
    expect(redirectTarget({ from: "x" })).toBe("/dashboard");
    expect(redirectTarget({ from: {} })).toBe("/dashboard");
    expect(redirectTarget({ from: { pathname: 42 } })).toBe("/dashboard");
  });
});

describe("canResend", () => {
  it("bloqueia dentro do cooldown e libera depois", () => {
    expect(canResend(1000, 1000)).toBe(false);
    expect(canResend(1000, 1000 + RESEND_COOLDOWN_MS - 1)).toBe(false);
    expect(canResend(1000, 1000 + RESEND_COOLDOWN_MS)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
bun --filter @dailify/web test -- auth-state
```

Esperado: FAIL com "Failed to resolve import ./auth-state".

- [ ] **Step 3: Implementar**

Crie `apps/web/src/components/auth/auth-state.ts`:

```ts
/**
 * Lógica pura das telas de auth. Fica fora do React de propósito: o repo não tem
 * @testing-library/react nem jsdom, então o que merece teste precisa ser função pura.
 * `use-email-link-auth.ts` é só o fio que liga o Clerk a este reducer.
 */

export type AuthMode = "signIn" | "signUp";

export type AuthErrorKey =
  | "invalidEmail"
  | "blockedEmail"
  | "captcha"
  | "tooManyRequests"
  | "generic";

/** Um erro vira uma mensagem, ou um convite pra ir pra outra tela. */
export type AuthFailure =
  | { kind: "message"; key: AuthErrorKey; code?: string }
  | { kind: "offer"; mode: AuthMode };

export type AuthState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "awaitingLink"; email: string; sentAt: number }
  | { status: "expired"; email: string }
  | { status: "error"; failure: AuthFailure }
  | { status: "verified" };

export type AuthAction =
  | { type: "submit" }
  | { type: "linkSent"; email: string; at: number }
  | { type: "expired" }
  | { type: "failed"; failure: AuthFailure }
  | { type: "verified" }
  | { type: "reset" };

export const initialAuthState: AuthState = { status: "idle" };

export const RESEND_COOLDOWN_MS = 30_000;

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "submit":
      // Retornar o mesmo objeto (e não um novo igual) faz o React pular o re-render.
      return state.status === "sending" ? state : { status: "sending" };
    case "linkSent":
      return state.status === "sending"
        ? { status: "awaitingLink", email: action.email, sentAt: action.at }
        : state;
    case "expired":
      return state.status === "awaitingLink" ? { status: "expired", email: state.email } : state;
    case "failed":
      return { status: "error", failure: action.failure };
    case "verified":
      return { status: "verified" };
    case "reset":
      return initialAuthState;
  }
}

/**
 * Traduz um `code` do Clerk numa falha que a tela sabe renderizar.
 *
 * `form_identifier_not_found` e `form_identifier_exists` só viram convite no modo em que são
 * inesperados — no outro modo eles são o caminho normal e nem chegam aqui.
 */
export function classifyClerkError(code: string, mode: AuthMode): AuthFailure {
  if (code === "form_identifier_not_found" && mode === "signIn") {
    return { kind: "offer", mode: "signUp" };
  }
  if (code === "form_identifier_exists" && mode === "signUp") {
    return { kind: "offer", mode: "signIn" };
  }
  if (code === "form_param_format_invalid") return { kind: "message", key: "invalidEmail" };
  if (code === "form_email_address_blocked") return { kind: "message", key: "blockedEmail" };
  if (code === "captcha_invalid" || code === "captcha_unavailable") {
    return { kind: "message", key: "captcha" };
  }
  if (code === "too_many_requests") return { kind: "message", key: "tooManyRequests" };
  return { kind: "message", key: "generic", code };
}

/** De onde o ProtectedRoute mandou o usuário — `location.state` é `unknown` por definição. */
export function redirectTarget(state: unknown): string {
  if (state === null || typeof state !== "object" || !("from" in state)) return "/dashboard";
  const { from } = state;
  if (from === null || typeof from !== "object") return "/dashboard";
  const pathname = "pathname" in from && typeof from.pathname === "string" ? from.pathname : "";
  const search = "search" in from && typeof from.search === "string" ? from.search : "";
  return pathname + search || "/dashboard";
}

export function canResend(sentAt: number, now: number): boolean {
  return now - sentAt >= RESEND_COOLDOWN_MS;
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
bun --filter @dailify/web test -- auth-state
```

Esperado: PASS, ~20 testes.

- [ ] **Step 5: Gate e commit**

```bash
bun run format && bun run check
git add apps/web/src/components/auth/
git commit -m "feat(web): maquina de estados pura das telas de auth"
```

---

### Task 2: `copy.ts` — o dicionário pt-BR

**Files:**
- Create: `apps/web/src/components/auth/copy.ts`
- Test: `apps/web/src/components/auth/copy.test.ts`

**Interfaces:**
- Consumes: `AuthErrorKey` (Task 1)
- Produces: `copy`, `type AuthCopy`

- [ ] **Step 1: Escrever o teste que falha**

Crie `apps/web/src/components/auth/copy.test.ts`:

```ts
import { describe, it, expect } from "vitest";

import { copy } from "./copy";

describe("auth copy", () => {
  it("tem todas as seções", () => {
    for (const section of ["shell", "signIn", "signUp", "inbox", "verify", "errors"] as const) {
      expect(copy[section]).toBeTruthy();
    }
  });

  it("não tem nenhuma string vazia", () => {
    expect(JSON.stringify(copy)).not.toMatch(/""/);
  });

  it("cobre toda AuthErrorKey", () => {
    for (const key of [
      "invalidEmail",
      "blockedEmail",
      "captcha",
      "tooManyRequests",
      "generic",
    ] as const) {
      expect(copy.errors[key]).toBeTruthy();
    }
  });

  it("o rodapé legal difere entre entrar e criar conta", () => {
    expect(copy.signIn.legalPrefix).not.toBe(copy.signUp.legalPrefix);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
bun --filter @dailify/web test -- auth/copy
```

Esperado: FAIL com `Error: Cannot find module './copy' imported from …/copy.test.ts`, `(0 test)`,
`Failed Suites 1`, saída com código 1.

Essa é a mensagem do resolver do **Node**, não a do vite. O `Failed to resolve import` do vite fica
atrás de um `if (ssr)` em `dep-Dm0c1Wj2.js:40620`, e como `vite.config.ts:31` declara
`test.environment: "node"`, aquele caminho é pulado. Verificado com execução real na Task 1 — não
troque por outra mensagem achando que esta está errada.

- [ ] **Step 3: Implementar**

Crie `apps/web/src/components/auth/copy.ts`:

```ts
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
    generic: "Algo deu errado. Tente de novo.",
    offerSignUp: "Não achei uma conta com esse e-mail.",
    offerSignUpAction: "Criar conta",
    offerSignIn: "Já existe uma conta com esse e-mail.",
    offerSignInAction: "Entrar",
  },
} as const;

/** O contrato que um locale futuro precisa cumprir (bd Dailify-1xy). */
export type AuthCopy = typeof copy;
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
bun --filter @dailify/web test -- auth/copy
```

Esperado: PASS, 4 testes.

- [ ] **Step 5: Gate e commit**

```bash
bun run format && bun run check
git add apps/web/src/components/auth/copy.ts apps/web/src/components/auth/copy.test.ts
git commit -m "feat(web): dicionario de copy pt-BR das telas de auth"
```

---

### Task 3: `AuthShell` e `OAuthButtons` — a casca visual

Layout puro, sem lógica de auth. Verificável a olho antes de qualquer fluxo existir.

**Files:**
- Create: `apps/web/src/components/auth/auth-shell.tsx`
- Create: `apps/web/src/components/auth/oauth-buttons.tsx`

**Interfaces:**
- Consumes: `copy` (Task 2), `Brand` (`@/components/brand`), `Button`, `Separator` (shadcn)
- Produces: `<AuthShell>{children}</AuthShell>` com `title`, `legalPrefix`, `crossLinkPrefix`, `crossLinkAction`, `crossLinkTo` **todos opcionais**; `<OAuthButtons onGoogle disabled />`

> As props do `AuthShell` são opcionais porque a Task 7 monta a `/verify` com a mesma casca, e essa
> tela não tem cross-link nem rodapé legal. Sem isso a Task 7 duplicaria o chrome inteiro.
>
> A remoção do `AppleLogo` NÃO acontece aqui — ela vive na Task 6, junto da reescrita do
> `pages/login.tsx` que hoje o importa. Removê-lo antes deixaria a branch sem compilar por três
> commits, contra a Global Constraint de `bun run check` verde em todo commit.

- [ ] **Step 1: Criar o `AuthShell`**

Crie `apps/web/src/components/auth/auth-shell.tsx`:

```tsx
import { Link } from "react-router-dom";

import { Brand } from "@/components/brand";
import { copy } from "@/components/auth/copy";

/**
 * Casca das telas de auth. O bloco (título + card) é o que fica centrado na viewport; a marca e o
 * rodapé legal ficam em `absolute` e por isso não empurram nada — tirar o logo não move o card.
 *
 * `min-h-dvh` e não `h-dvh`: com altura fixa, a marca em `bottom-full` sai por cima do topo numa
 * janela baixa. Com `min-h` a página rola.
 */
export function AuthShell({
  title,
  legalPrefix,
  crossLinkPrefix,
  crossLinkAction,
  crossLinkTo,
  children,
}: {
  /** Ausentes na /verify, que usa a mesma casca sem título, cross-link ou rodapé legal. */
  title?: string;
  legalPrefix?: string;
  crossLinkPrefix?: string;
  crossLinkAction?: string;
  crossLinkTo?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <main className="relative grid min-h-dvh place-items-center bg-surface-page px-4 py-24">
      <div className="relative w-full max-w-[380px]">
        <div className="absolute bottom-full left-1/2 mb-10 -translate-x-1/2">
          <Brand to="/" />
        </div>

        {title && (
          <h1 className="mb-6 text-center text-2xl font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h1>
        )}

        <div className="flex flex-col gap-4 rounded-panel border border-surface-line bg-surface-card p-6 shadow-panel">
          {children}

          {crossLinkTo && (
            <p className="text-center text-sm text-muted-foreground">
              {crossLinkPrefix}{" "}
              <Link to={crossLinkTo} className="text-primary underline-offset-4 hover:underline">
                {crossLinkAction}
              </Link>
            </p>
          )}
        </div>
      </div>

      {legalPrefix && (
        <p className="absolute inset-x-0 bottom-5 px-4 text-center text-xs text-muted-foreground">
          {legalPrefix}
          <Link to="/termos" className="underline underline-offset-4 hover:text-foreground">
            {copy.shell.terms}
          </Link>
          {copy.shell.legalAnd}
          <Link to="/privacidade" className="underline underline-offset-4 hover:text-foreground">
            {copy.shell.privacy}
          </Link>
        </p>
      )}

      {/* Obrigatório: a proteção anti-bot do Clerk é ligada por padrão no sign-up. */}
      <div id="clerk-captcha" />
    </main>
  );
}
```

- [ ] **Step 2: Criar o `OAuthButtons`**

Crie `apps/web/src/components/auth/oauth-buttons.tsx`:

```tsx
import { copy } from "@/components/auth/copy";
import { GoogleLogo } from "@/components/logos";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function OAuthButtons({
  onGoogle,
  disabled,
}: {
  onGoogle: () => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <>
      <div className="inline-flex items-center gap-3">
        <Separator className="shrink" />
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {copy.shell.dividerOr}
        </span>
        <Separator className="shrink" />
      </div>

      <Button type="button" variant="outline" onClick={onGoogle} disabled={disabled}>
        <GoogleLogo className="fill-foreground" />
        {copy.shell.continueWithGoogle}
      </Button>
    </>
  );
}
```

- [ ] **Step 3: Rodar o gate**

```bash
bun run format && bun run check
```

Esperado: PASS. Os dois arquivos são novos e ninguém os importa ainda, então nada quebra. Se o `tsc` reclamar de `AppleLogo`, você removeu o logo por engano — ele sai na Task 6, não aqui.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/auth-shell.tsx apps/web/src/components/auth/oauth-buttons.tsx
git commit -m "feat(web): casca visual compartilhada das telas de auth"
```

---

### Task 4: `use-email-link-auth.ts` — o fio até o Clerk

**Files:**
- Create: `apps/web/src/components/auth/use-email-link-auth.ts`

**Interfaces:**
- Consumes: `authReducer`, `initialAuthState`, `classifyClerkError`, `redirectTarget`, `AuthMode`, `AuthState` (Task 1)
- Produces: `useEmailLinkAuth(mode): { state, submit(email), resend(), reset(), signInWithGoogle(), isLoaded }`

> **O código abaixo tem dois defeitos, corrigidos em `96de436`. Não copie deste bloco.**
>
> 1. Ele trata só `expired` e `complete`. Mas `startEmailLinkFlow` **resolve** com `status: "failed"`
>    no client mismatch — o usuário abre o link do e-mail no celular com o formulário no notebook.
>    Nada é lançado, o `catch` não pega, e a aba fica em `awaitingLink` pra sempre dizendo "confira
>    seu e-mail". Correção: depois de cada await, qualquer resolução não-`complete` despacha `failed`.
> 2. Ele descarta o `cancelEmailLinkFlow`. Sem cleanup, o reenvio empilha um poller sobre o anterior,
>    e o `expired` do antigo derruba um link novo ainda válido. Correção: guardar o canceller num
>    ref, chamá-lo antes de iniciar um fluxo novo e no unmount — que é exatamente o que o
>    `useEmailLink` do próprio Clerk faz.
>
> Fica aqui como estava porque o ledger do SDD argumenta contra este texto. O arquivo real é a
> fonte de verdade.

- [ ] **Step 1: Implementar o hook**

Crie `apps/web/src/components/auth/use-email-link-auth.ts`:

```ts
import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { isClerkAPIResponseError } from "@clerk/clerk-react/errors";
import type { EmailLinkFactor, OAuthStrategy } from "@clerk/types";
import { useCallback, useReducer, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  authReducer,
  classifyClerkError,
  initialAuthState,
  redirectTarget,
  type AuthMode,
} from "@/components/auth/auth-state";

/**
 * Liga o Clerk ao reducer de `auth-state.ts`. Nada de lógica mora aqui — se você for escrever um
 * `if` que não seja sobre a API do Clerk, ele pertence ao reducer, onde dá pra testar.
 *
 * O `redirectUrl` sai de `window.location.origin` e NÃO do `dailifyURL` de consts: aquele é a URL
 * de produção hardcoded, e usá-la fazia o link do e-mail em dev apontar pra prod.
 */
export function useEmailLinkAuth(mode: AuthMode) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { signUp } = useSignUp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = redirectTarget(location.state);

  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  // Guardado num ref porque o `resend` precisa do último e-mail sem virar dependência do callback.
  const lastEmail = useRef("");

  const fail = useCallback(
    (err: unknown) => {
      const code = isClerkAPIResponseError(err) ? err.errors[0]?.code : undefined;
      dispatch({ type: "failed", failure: classifyClerkError(code ?? "unknown", mode) });
    },
    [mode],
  );

  const start = useCallback(
    async (email: string) => {
      if (!isLoaded || !signIn || !signUp) return;

      lastEmail.current = email;
      dispatch({ type: "submit" });

      const redirectUrl = `${window.location.origin}/verify`;

      try {
        if (mode === "signUp") {
          await signUp.create({
            emailAddress: email,
            unsafeMetadata: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          });

          const { startEmailLinkFlow } = signUp.createEmailLinkFlow();
          dispatch({ type: "linkSent", email, at: Date.now() });

          const attempt = await startEmailLinkFlow({ redirectUrl });
          const verification = attempt.verifications.emailAddress;

          if (verification.status === "expired") return dispatch({ type: "expired" });
          if (attempt.status === "complete" && attempt.createdSessionId) {
            await setActive?.({ session: attempt.createdSessionId });
            dispatch({ type: "verified" });
            navigate(from, { replace: true });
          }
          return;
        }

        const { supportedFirstFactors } = await signIn.create({ identifier: email });
        const factor = supportedFirstFactors?.find(
          (f): f is EmailLinkFactor => f.strategy === "email_link",
        );
        if (!factor) return dispatch({ type: "failed", failure: { kind: "message", key: "generic" } });

        const { startEmailLinkFlow } = signIn.createEmailLinkFlow();
        dispatch({ type: "linkSent", email, at: Date.now() });

        const attempt = await startEmailLinkFlow({
          emailAddressId: factor.emailAddressId,
          redirectUrl,
        });

        if (attempt.firstFactorVerification.status === "expired") {
          return dispatch({ type: "expired" });
        }
        if (attempt.status === "complete" && attempt.createdSessionId) {
          await setActive?.({ session: attempt.createdSessionId });
          dispatch({ type: "verified" });
          navigate(from, { replace: true });
        }
      } catch (err) {
        fail(err);
      }
    },
    [isLoaded, signIn, signUp, mode, setActive, navigate, from, fail],
  );

  return {
    state,
    isLoaded,
    submit: start,
    resend: useCallback(() => start(lastEmail.current), [start]),
    reset: useCallback(() => dispatch({ type: "reset" }), []),
    signInWithGoogle: useCallback(() => {
      if (!signIn) return;
      const strategy: OAuthStrategy = "oauth_google";
      signIn
        .authenticateWithRedirect({
          strategy,
          redirectUrl: "/sso-callback",
          redirectUrlComplete: from,
        })
        .catch(fail);
    }, [signIn, from, fail]),
  };
}
```

- [ ] **Step 2: Rodar o gate**

```bash
bun run format && bun run check
```

Esperado: PASS. O hook ainda não é importado por ninguém, então nada quebra.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/auth/use-email-link-auth.ts
git commit -m "feat(web): hook que liga o Clerk a maquina de estados de auth"
```

---

### Task 5: `EmailForm` e `CheckInbox`

**Files:**
- Create: `apps/web/src/components/auth/email-form.tsx`
- Create: `apps/web/src/components/auth/check-inbox.tsx`

**Interfaces:**
- Consumes: `AuthState`, `AuthFailure`, `canResend`, `RESEND_COOLDOWN_MS` (Task 1), `copy` (Task 2), `formString` (`@/lib/form`)
- Produces: `<EmailForm onSubmit disabled submitLabel failure />`, `<CheckInbox email sentAt onResend onBack />`

- [ ] **Step 1: Criar o `EmailForm`**

Crie `apps/web/src/components/auth/email-form.tsx`:

```tsx
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { Link } from "react-router-dom";

import type { AuthFailure } from "@/components/auth/auth-state";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formString } from "@/lib/form";

/** A oferta é um erro que vira convite: o e-mail existe (ou não) na tela errada. */
function Offer({ mode }: { mode: "signIn" | "signUp" }): JSX.Element {
  const isSignUp = mode === "signUp";
  return (
    <p className="text-sm text-muted-foreground">
      {isSignUp ? copy.errors.offerSignUp : copy.errors.offerSignIn}{" "}
      <Link
        to={isSignUp ? "/signup" : "/login"}
        className="text-primary underline-offset-4 hover:underline"
      >
        {isSignUp ? copy.errors.offerSignUpAction : copy.errors.offerSignInAction}
      </Link>
    </p>
  );
}

export function EmailForm({
  onSubmit,
  disabled,
  submitLabel,
  failure,
}: {
  onSubmit: (email: string) => void;
  disabled: boolean;
  submitLabel: string;
  failure?: AuthFailure;
}): JSX.Element {
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formString(new FormData(e.currentTarget), "email"));
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="email"
          className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
        >
          {copy.shell.emailLabel}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={copy.shell.emailPlaceholder}
          aria-invalid={failure?.kind === "message"}
        />
      </div>

      {failure?.kind === "message" && (
        <p className="text-sm text-destructive">
          {copy.errors[failure.key]}
          {failure.code && (
            <span className="ml-1 font-mono text-2xs uppercase tracking-[0.04em] opacity-70">
              {failure.code}
            </span>
          )}
        </p>
      )}

      {failure?.kind === "offer" && <Offer mode={failure.mode} />}

      <Button type="submit" disabled={disabled}>
        {disabled ? <Loader2Icon className="animate-spin" /> : null}
        {submitLabel}
        {disabled ? null : <ArrowRightIcon />}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Criar o `CheckInbox`**

Crie `apps/web/src/components/auth/check-inbox.tsx`:

```tsx
import { ArrowLeftIcon, MailIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { canResend, RESEND_COOLDOWN_MS } from "@/components/auth/auth-state";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";

/** Segundos que faltam pro reenvio liberar. Zero = liberado. */
function useCooldown(sentAt: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (canResend(sentAt, Date.now())) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sentAt]);

  return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - now) / 1000));
}

export function CheckInbox({
  email,
  sentAt,
  onResend,
  onBack,
}: {
  email: string;
  sentAt: number;
  onResend: () => void;
  onBack: () => void;
}): JSX.Element {
  const remaining = useCooldown(sentAt);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="rounded-full bg-accent-subtle p-4">
        <MailIcon className="size-6 text-primary" />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{copy.inbox.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.inbox.sentTo}</p>
        <p className="font-mono text-sm text-foreground">{email}</p>
      </div>

      <p className="text-sm text-muted-foreground">{copy.inbox.hint}</p>

      <Button variant="outline" className="w-full" onClick={onResend} disabled={remaining > 0}>
        <RotateCwIcon />
        {remaining > 0
          ? `${copy.inbox.resendIn} ${remaining}${copy.inbox.seconds}`
          : copy.inbox.resend}
      </Button>

      <Button variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeftIcon />
        {copy.inbox.back}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Rodar o gate**

```bash
bun run format && bun run check
```

Esperado: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/email-form.tsx apps/web/src/components/auth/check-inbox.tsx
git commit -m "feat(web): formulario de e-mail e tela de caixa de entrada"
```

---

### Task 6: As páginas `/login` e `/signup`, e as rotas

Aqui o gate volta a passar — o `login.tsx` antigo some.

**Files:**
- Create: `apps/web/src/components/auth/auth-page.tsx`
- Rewrite: `apps/web/src/pages/login.tsx`
- Create: `apps/web/src/pages/signup.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/logos.tsx` (remove `AppleLogo`)
- Delete: `apps/web/src/components/verifying-link.tsx`, `apps/web/src/components/sso-callback.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 1-5
- Produces: rotas `/login`, `/signup`, `/sso-callback`

- [ ] **Step 1: Criar o corpo compartilhado**

Crie `apps/web/src/components/auth/auth-page.tsx`:

```tsx
import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

import type { AuthMode } from "@/components/auth/auth-state";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckInbox } from "@/components/auth/check-inbox";
import { copy } from "@/components/auth/copy";
import { EmailForm } from "@/components/auth/email-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { useEmailLinkAuth } from "@/components/auth/use-email-link-auth";

/**
 * Corpo comum de /login e /signup. As duas rotas são a MESMA mecânica — a separação é de
 * enquadramento, então o que muda é só a copy e o destino do cross-link.
 */
export function AuthPage({ mode }: { mode: AuthMode }): JSX.Element {
  const { isSignedIn } = useUser();
  const { state, isLoaded, submit, resend, reset, signInWithGoogle } = useEmailLinkAuth(mode);
  const text = mode === "signUp" ? copy.signUp : copy.signIn;

  // Quem já está logado não tem o que fazer aqui.
  if (isSignedIn) return <Navigate to="/dashboard" replace />;

  return (
    <AuthShell
      title={text.title}
      legalPrefix={text.legalPrefix}
      crossLinkPrefix={text.crossLinkPrefix}
      crossLinkAction={text.crossLinkAction}
      crossLinkTo={mode === "signUp" ? "/login" : "/signup"}
    >
      {state.status === "awaitingLink" ? (
        <CheckInbox
          email={state.email}
          sentAt={state.sentAt}
          onResend={resend}
          onBack={reset}
        />
      ) : (
        <>
          <EmailForm
            onSubmit={submit}
            disabled={!isLoaded || state.status === "sending"}
            submitLabel={text.submit}
            failure={state.status === "error" ? state.failure : undefined}
          />
          <OAuthButtons onGoogle={signInWithGoogle} disabled={!isLoaded} />
        </>
      )}
    </AuthShell>
  );
}
```

- [ ] **Step 2: Reescrever `login.tsx` e criar `signup.tsx`**

Substitua todo o conteúdo de `apps/web/src/pages/login.tsx` por:

```tsx
import { AuthPage } from "@/components/auth/auth-page";

export default function Login() {
  return <AuthPage mode="signIn" />;
}
```

Crie `apps/web/src/pages/signup.tsx`:

```tsx
import { AuthPage } from "@/components/auth/auth-page";

export default function SignUp() {
  return <AuthPage mode="signUp" />;
}
```

- [ ] **Step 3: Ajustar as rotas**

Em `apps/web/src/App.tsx`:

1. Troque `import SSOCallback from "./components/sso-callback";` (linha 7) por nada — apague a linha.
2. Adicione `import SignUp from "./pages/signup";` junto dos outros imports de página.
3. Adicione `import { AuthenticateWithRedirectCallback } from "@clerk/clerk-react";` no topo.
4. Substitua o bloco das linhas 62-77 por:

```tsx
                <Route
                  path="/login"
                  element={
                    <>
                      <Helmet>
                        <title>{copy.signIn.pageTitle}</title>
                      </Helmet>

                      <Login />
                    </>
                  }
                />

                <Route
                  path="/signup"
                  element={
                    <>
                      <Helmet>
                        <title>{copy.signUp.pageTitle}</title>
                      </Helmet>

                      <SignUp />
                    </>
                  }
                />

                <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />

                <Route path="/verify" element={<Verify />} />
```

5. Adicione `import { copy } from "@/components/auth/copy";` no topo.

- [ ] **Step 4: Apagar os arquivos absorvidos e o `AppleLogo`**

```bash
git rm apps/web/src/components/verifying-link.tsx apps/web/src/components/sso-callback.tsx
```

Em `apps/web/src/components/logos.tsx`, apague a função `AppleLogo` inteira (linhas 22-36), deixando só `LogoProps` e `GoogleLogo`. É aqui e não na Task 3 porque o `pages/login.tsx` antigo importava `AppleLogo` — removê-lo antes deixaria a branch sem compilar. Este é o commit em que as duas pontas fecham.

Confirme que ninguém mais o referencia:

```bash
grep -rn "AppleLogo" apps/web/src && echo "AINDA REFERENCIADO — apague os usos" || echo "limpo"
```

- [ ] **Step 5: Rodar o gate completo**

```bash
bun run format && bun run check
```

Esperado: PASS. 191 + 24 testes (os novos das Tasks 1 e 2). Se `tsc` reclamar de `AppleLogo`, algum import antigo ficou — grepe por `AppleLogo` e apague.

- [ ] **Step 6: Verificar a olho**

```bash
bun run dev
```

Abra `https://localhost:1420/login` e `https://localhost:1420/signup`. Confira: logo 40px acima do título, card centrado com no máximo 380px, rodapé colado a 20px do fundo, e o texto legal diferente entre as duas telas. Alterne o tema no SO e recarregue — as duas devem seguir.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): /login e /signup como rotas separadas com o mesmo motor"
```

---

### Task 7: `/verify` honesta

**Files:**
- Rewrite: `apps/web/src/pages/verify.tsx`

**Interfaces:**
- Consumes: `copy.verify` (Task 2), `AuthShell` (Task 3) — montado **sem props**, só com children
- Produces: nada (folha)

- [ ] **Step 1: Reescrever**

Substitua todo o conteúdo de `apps/web/src/pages/verify.tsx` por:

```tsx
import { useClerk } from "@clerk/clerk-react";
import { EmailLinkErrorCodeStatus, isEmailLinkError } from "@clerk/clerk-react/errors";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";

type Status = "loading" | "verified" | "verified_switch_tab" | "expired" | "client_mismatch" | "failed";

/**
 * A aba que o link do e-mail abre.
 *
 * A versão anterior era estática: dizia "Authentication Successful" sempre, inclusive com o link
 * expirado ou aberto em outro dispositivo, e chamava `window.close()` — que o navegador ignora em
 * abas que o script não abriu. Agora ela chama de fato o Clerk e mostra o que aconteceu.
 */
export default function Verify() {
  const { handleEmailLinkVerification, loaded } = useClerk();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!loaded) return;

    handleEmailLinkVerification({
      onVerifiedOnOtherDevice: () => setStatus("verified_switch_tab"),
    })
      .then(() => setStatus((prev) => (prev === "loading" ? "verified" : prev)))
      .catch((err: unknown) => {
        if (isEmailLinkError(err)) {
          if (err.code === EmailLinkErrorCodeStatus.Expired) return setStatus("expired");
          if (err.code === EmailLinkErrorCodeStatus.ClientMismatch) {
            return setStatus("client_mismatch");
          }
        }
        setStatus("failed");
      });
  }, [handleEmailLinkVerification, loaded]);

  const message = {
    loading: copy.verify.loading,
    verified: copy.verify.verified,
    verified_switch_tab: copy.verify.switchTab,
    expired: copy.verify.expired,
    client_mismatch: copy.verify.clientMismatch,
    failed: copy.verify.failed,
  }[status];

  const canRestart = status === "expired" || status === "failed";

  // Mesma casca de /login e /signup, sem título, cross-link ou rodapé legal — todos opcionais.
  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-4 text-center">
        {status === "loading" && <Loader2Icon className="size-6 animate-spin text-primary" />}

        <p className="text-sm text-foreground">{message}</p>

        {canRestart && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">{copy.verify.restart}</Link>
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
```

- [ ] **Step 2: Rodar o gate**

```bash
bun run format && bun run check
```

Esperado: PASS.

Os dois símbolos foram conferidos na versão instalada: `@clerk/clerk-react@5.61.3` reexporta
`isEmailLinkError` e `EmailLinkErrorCodeStatus` de `@clerk/shared/error`, e o enum é
`{ Expired: "expired", Failed: "failed", ClientMismatch: "client_mismatch" }`. Não invente outro
import.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/verify.tsx
git commit -m "fix(web): /verify le o status real em vez de sempre dizer sucesso"
```

---

### Task 8: Religar os CTAs da landing

O CTA principal da landing não navega pra lugar nenhum hoje. Agora existe destino.

**Files:**
- Modify: `apps/web/src/components/landing/hero.tsx:57-72`
- Modify: `apps/web/src/components/landing/cta.tsx:45`

**Interfaces:**
- Consumes: as rotas da Task 6
- Produces: nada

- [ ] **Step 1: Ligar os botões do hero**

Em `apps/web/src/components/landing/hero.tsx`, adicione `import { Link } from "react-router-dom";` no topo e substitua o bloco das linhas 57-72 por:

```tsx
        <div className="flex flex-wrap items-center gap-4">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-accent-primary text-primary-foreground hover:bg-accent-hover"
          >
            <Link to="/signup">{copy.hero.ctaPrimary}</Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="ghost"
            className="rounded-full border-t border-t-surface-line bg-surface-card hover:bg-surface-hover"
          >
            <a href="#features">{copy.hero.ctaSecondary}</a>
          </Button>
        </div>
```

- [ ] **Step 2: Apontar o CTA de fechamento pro cadastro**

Em `apps/web/src/components/landing/cta.tsx:45`, troque `to="/login"` por `to="/signup"`.

- [ ] **Step 3: Rodar o gate**

```bash
bun run format && bun run check
```

Esperado: PASS.

- [ ] **Step 4: Verificar a olho**

```bash
bun run dev
```

Em `https://localhost:1420/`, clique no CTA do hero (vai pra `/signup`), no secundário (rola pra seção de recursos) e no CTA do rodapé (vai pra `/signup`). O "Entrar" do header continua indo pra `/login`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/landing/
git commit -m "fix(web): CTAs do hero passam a navegar, e a conversao vai pro /signup"
```

---

### Task 9: O anexo do tema

Quatro correções independentes no mesmo território.

**Files:**
- Modify: `apps/web/src/App.tsx` (a linha do `<ThemeProvider …>` — **não confie no número**, a Task 6 já editou este arquivo e deslocou as linhas)
- Modify: `apps/web/src/components/theme-provider.tsx:38-53`
- Modify: `apps/web/index.html`
- Modify: `apps/web/src/components/mode-toggle.tsx:28-34`
- Modify: `apps/web/src/components/dashboard/copy.ts`

**Interfaces:**
- Consumes: `copy` de `dashboard/copy.ts`
- Produces: nada

- [ ] **Step 1: Fazer `system` ser o padrão de verdade**

Em `apps/web/src/App.tsx`, troque `<ThemeProvider defaultTheme="dark">` por `<ThemeProvider>`. O provider já declara `defaultTheme = "system"`. Ancore pelo conteúdo, não pelo número da linha — a Task 6 editou este arquivo.

- [ ] **Step 2: Reagir à troca de tema no SO**

Em `apps/web/src/components/theme-provider.tsx`, substitua o `useEffect` das linhas 38-53 por:

```tsx
  useEffect(() => {
    const root = window.document.documentElement;

    const apply = (value: Theme) => {
      root.classList.remove("light", "dark");
      root.classList.add(
        value === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : value,
      );
    };

    apply(theme);

    if (theme !== "system") return;

    // Sem este listener, quem está em "system" só acompanha o modo noturno do SO após um reload.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);
```

- [ ] **Step 3: Matar o flash de tema errado**

Em `apps/web/index.html`, troque `<html lang="en">` por `<html lang="pt-BR">` e adicione, como último elemento dentro do `<head>`:

```html
  <script>
    // Aplica o tema antes do primeiro paint. A chave e a lógica precisam ficar idênticas às do
    // theme-provider.tsx — divergir aqui produz um flash pior que o de não ter script nenhum.
    (function () {
      var stored = localStorage.getItem("vite-ui-theme");
      var theme = stored === "light" || stored === "dark" ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      document.documentElement.classList.add(theme);
    })();
  </script>
```

- [ ] **Step 4: Mostrar qual tema está ativo**

Em `apps/web/src/components/dashboard/copy.ts`, adicione dentro de `header`:

```ts
    themeToggle: "Alternar tema",
    themeLight: "Claro",
    themeDark: "Escuro",
    themeSystem: "Sistema",
```

Em `apps/web/src/components/mode-toggle.tsx`: troque `const { setTheme } = useTheme();` por `const { theme, setTheme } = useTheme();`, adicione `import { copy } from "@/components/dashboard/copy";`, troque o `<span className="sr-only">Toggle theme</span>` por `{copy.header.themeToggle}`, importe `DropdownMenuRadioGroup` e `DropdownMenuRadioItem` de `@/components/ui/dropdown-menu`, e substitua o `<DropdownMenuContent>` por:

```tsx
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(isTheme(v) ? v : "system")}>
          <DropdownMenuRadioItem value="light">{copy.header.themeLight}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{copy.header.themeDark}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">{copy.header.themeSystem}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
```

Para o `isTheme`, exporte-o de `theme-provider.tsx` (hoje ele é local, na linha 6) adicionando `export` na frente, e importe no `mode-toggle.tsx`. Isso evita um `as` no `onValueChange`, que a regra do repo proíbe.

- [ ] **Step 5: Rodar o gate**

```bash
bun run format && bun run check
```

Esperado: PASS. O teste `dashboard/copy.test.ts` valida que nenhuma string nova ficou vazia.

- [ ] **Step 6: Verificar a olho**

```bash
bun run dev
```

Três checagens:
1. Limpe `localStorage` (`localStorage.clear()` no console) e recarregue: o app deve nascer no tema do SO, não em dark.
2. Com o toggle em "Sistema", troque o tema do SO com a aba aberta — o app deve virar sem reload.
3. Com o tema em dark, recarregue com a aba de rede em "Slow 3G" — não deve haver flash branco.

- [ ] **Step 7: Commit**

```bash
git add -A apps/web
git commit -m "fix(web): tema do sistema vira o padrao real e passa a reagir ao SO"
```

---

## Fechamento

- [ ] **Rodar o gate completo uma última vez**

```bash
bun run check
```

Esperado: PASS, com pelo menos 234 testes (213 da baseline + ~21 novos das Tasks 1 e 2).

- [ ] **Atualizar a documentação de rotas**

Em `apps/web/src/pages/CLAUDE.md`, atualize a tabela: `/login` e `/signup` (as duas usando `components/auth/`), `/sso-callback` no lugar de `/login/sso-callback`, e `/verify` no lugar de `/sign-in/verify`.

Em `apps/web/src/components/CLAUDE.md`, adicione uma linha sobre `auth/`: a lógica pura mora em `auth-state.ts` e é o único arquivo testado; o hook é só o fio até o Clerk.

- [ ] **Fechar as issues do bd**

```bash
bd close Dailify-5w6 Dailify-9m7 Dailify-8ii
```

- [ ] **Push**

```bash
git pull --rebase && git push && git status
```

Precisa mostrar "up to date with origin".
