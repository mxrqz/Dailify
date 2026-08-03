# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar a landing page do Dailify (`apps/web/src/pages/landingPage.tsx`) para a identidade dark-first, crimson-única, Geist+mono, com grão vivo e 4 momentos-assinatura (hero flutuante, switcher tipo aba, bento de conceitos-TEMPO, footer que dissolve).

**Architecture:** Quebrar a página monolítica de 632 linhas numa pasta `components/landing/*` com um componente por seção (grain, hero, feature-tabs, bento, how-it-works, pricing, cta, footer) + um dicionário de copy pt-BR (`copy.ts`) pré-pronto para i18n. `landingPage.tsx` vira uma composição fina. Tokens novos estendem `global.css` (via `light-dark()` oklch — sem duplicar). Animações via `framer-motion@12` (já instalado) com `useReducedMotion` em tudo. Switcher via `components/ui/tabs.tsx` (Radix, já existe) + `layoutId`.

**Tech Stack:** React 18 + Vite + TypeScript · Tailwind v4 (CSS-first `@theme`) · shadcn/ui · framer-motion@12 · @radix-ui/react-tabs · @fontsource-variable/geist(+mono).

**Fonte da verdade do design:** `Prompt identidade visual.md` (raiz). Referências visuais: `design/references/ref-00..04`. Abrir ambos antes de começar.

## Global Constraints

_Toda task herda estas regras. Valores copiados verbatim do doc/projeto._

- **Dark-first temável:** cada cor definida UMA vez via `light-dark(light, dark)` em `oklch` em `global.css`. Deve funcionar em **light e dark** (o app tem toggle), mas o alvo estético é dark. NUNCA `prefers-color-scheme` (o projeto usa a classe `.dark` via `color-scheme`).
- **UMA cor viva:** crimson = `--primary` = `oklch(58.6% 0.222 17.6)`. Nenhuma outra cor vibrante. O gradiente de marca (`--brand-*`) **não** aparece na landing.
- **Tipografia:** Geist Sans (`--font-sans`) + Geist Mono (`--font-mono`), via `@fontsource-variable/geist` e `@fontsource-variable/geist-mono` (o pacote `geist` é Next-only; NÃO usar em Vite).
- **Sem `as` type assertions** (usar type guards / tipos corretos; `as const` ok). ESLint warning.
- **Prettier** printWidth 100. Gate completo: `bun run check` (format+lint+typecheck+test) na raiz, ou `bun --filter @dailify/web check`.
- **Sem hex / valor cru** em componente — só tokens semânticos de `global.css` (classes Tailwind mapeadas). Sem `rounded-lg`/`shadow-md`/`gray-*` padrão do Tailwind.
- **Conteúdo verdadeiro:** planos `Free`/`Pro`/`Pro+AI` (NÃO existe "Team"). Free = 30 tarefas/mês, sem recorrência, sem voz. Pro = ilimitado + recorrência. Pro+AI = + voz. Números de `@dailify/shared` `PLAN_PERMISSIONS`; labels de `consts` `planMap`. Remover: "10 daily tasks", plano "Team", **seção de depoimentos inteira**, links-fantasma do footer (Blog, API Documentation, Careers, Integrations, Changelog, Help Center, Tutorials, About Us). Copyright **© 2026**.
- **Copy pt-BR** num dicionário tipado (`copy.ts`); **nenhuma string solta no JSX** (pré-pronto para o locale `en` — bd `Dailify-17s`/`1xy`).
- **`prefers-reduced-motion` respeitado** em TODA animação, via `useReducedMotion()` do framer-motion (troca `translate`→`opacity`, mata loops, grão estático).
- **Commits locais frequentes** (um por task). **NÃO dar `git push`** (instrução permanente do usuário). Trabalhar na branch `feat/landing-redesign`.

**Nota sobre verificação:** este é um redesign **visual**. A maioria das tasks NÃO tem teste unitário — verifica-se por (a) `bun run check` verde, (b) render sem erro em `bun run dev:front`, (c) conferência visual contra o doc/refs, (d) `prefers-reduced-motion` no devtools. Teste vitest só onde há **lógica pura** (T3 copy dict, T9 derivação de planos). NÃO inventar snapshot/RTL — o projeto não usa.

**Setup único (antes da Task 1):**
```bash
git checkout -b feat/landing-redesign
```

---

### Task 1: Foundations — fontes Geist + tokens novos

**Files:**
- Modify: `apps/web/package.json` (deps)
- Modify: `apps/web/src/main.tsx` (import das fontes)
- Modify: `apps/web/src/global.css` (`--font-sans`, `--font-mono`, tokens de superfície/accent/borda/raio + mapeamentos `@theme inline`)

**Interfaces:**
- Produces (classes Tailwind disponíveis p/ tasks seguintes): `font-sans` (Geist), `font-mono` (Geist Mono), `bg-surface-page`, `bg-surface-card`, `bg-surface-panel`, `bg-surface-hover`, `text-secondary`, `text-muted` (já existe `text-muted-foreground`), `bg-accent-primary`/`hover:bg-accent-hover`/`bg-accent-subtle`, `shadow-panel`, `rounded-panel`, `border-highlight`. (`--primary`, `--foreground`, `--muted-foreground`, `--border`, `--success` já existem — reusar.)

- [ ] **Step 1: Instalar fontes**
```bash
bun add @fontsource-variable/geist @fontsource-variable/geist-mono --cwd apps/web
```

- [ ] **Step 2: Importar as fontes em `main.tsx`** (topo, antes de `./App`)
```ts
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
```

- [ ] **Step 3: Trocar as fontes em `global.css`** (bloco `@theme`)
Trocar `--font-sans` para começar com `"Geist Variable"` e adicionar `--font-mono`:
```css
--font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",
  "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
--font-mono: "Geist Mono Variable", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
```

- [ ] **Step 4: Adicionar tokens novos** no bloco `:root` de `global.css` (após os existentes; valores dark-first via `light-dark`)
```css
/* landing — superfícies dark-first (page mais escura, painéis levantados) */
--surface-page: light-dark(oklch(100% 0 0), oklch(13% 0.004 49.3));
--surface-card: light-dark(oklch(98% 0 0), oklch(19% 0.005 56));
--surface-panel: light-dark(oklch(100% 0 0), oklch(21.6% 0.006 56));
--surface-hover: light-dark(oklch(96.8% 0.001 286.4), oklch(24% 0.005 56));
--text-secondary: light-dark(oklch(38% 0.01 286), oklch(80% 0.01 286));
--accent-hover: oklch(54% 0.222 17.6);
--accent-subtle: color-mix(in oklch, var(--primary) 10%, transparent);
--accent-glow: color-mix(in oklch, var(--primary) 20%, transparent);
--border-highlight: light-dark(oklch(90% 0.004 286.3), oklch(30% 0.005 286));
--radius-panel: 1.375rem;
```

- [ ] **Step 5: Mapear no `@theme inline`** (para virar classes Tailwind)
```css
--color-surface-page: var(--surface-page);
--color-surface-card: var(--surface-card);
--color-surface-panel: var(--surface-panel);
--color-surface-hover: var(--surface-hover);
--color-text-secondary: var(--text-secondary);
--color-accent-primary: var(--primary);
--color-accent-hover: var(--accent-hover);
--color-accent-subtle: var(--accent-subtle);
--color-accent-glow: var(--accent-glow);
--color-border-highlight: var(--border-highlight);
--radius-panel: var(--radius-panel);
--shadow-panel: 0 24px 60px -20px light-dark(oklch(0% 0 0 / 0.18), oklch(0% 0 0 / 0.55));
```

- [ ] **Step 6: Verificar** — build limpo e Geist aplicada.
Run: `bun --filter @dailify/web check`
Expected: PASS (0 erros de type/lint; prettier ok). Rodar `bun run dev:front`, abrir `/`, confirmar no devtools que `body` computa `font-family: "Geist Variable"`.

- [ ] **Step 7: Commit**
```bash
git add apps/web/package.json apps/web/bun.lock apps/web/src/main.tsx apps/web/src/global.css
git commit -m "feat(web): landing foundations — Geist fonts + dark-first surface/accent tokens"
```

---

### Task 2: Grão ambiente (`<Grain />`)

**Files:**
- Create: `apps/web/src/components/landing/grain.tsx`

**Interfaces:**
- Produces: `export function Grain(): JSX.Element` — overlay `fixed inset-0 pointer-events-none z-0`, feTurbulence data-URI, opacity 4–7%, animação de drift lenta; `useReducedMotion()` → estático.

- [ ] **Step 1: Implementar `Grain`**
Overlay fixo, atrás do conteúdo. Noise = `feTurbulence` (`type="fractalNoise"`, `baseFrequency ~0.8`, `numOctaves=4`) renderizado inline num `<svg>` ou como `background-image` data-URI num `<div>`. Opacity 0.05, `mix-blend-mode: overlay` (ou `soft-light`). O "respiro" = animar `transform: translate3d()` num loop lento (~18s, `ease-in-out`, `alternate`) OU `background-position`. Usar `useReducedMotion()`: se true, sem animação.
Padrão de reduced-motion (reusar em todas as tasks):
```tsx
import { useReducedMotion } from "framer-motion";
const reduce = useReducedMotion();
// aplicar animação só quando !reduce
```
A cena/parametrização segue o doc (§ "Textura Ambiente — o grão que respira"). Monocromático (neutro). Sem gradiente colorido.

- [ ] **Step 2: Verificar**
Run: `bun --filter @dailify/web check`
Expected: PASS. Render manual: overlay quase imperceptível; ativar "Emulate prefers-reduced-motion" no devtools → grão fica estático (sem drift).

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/landing/grain.tsx
git commit -m "feat(web): landing ambient grain overlay (reduced-motion aware)"
```

---

### Task 3: Dicionário de copy pt-BR (`copy.ts`) + teste

**Files:**
- Create: `apps/web/src/components/landing/copy.ts`
- Create: `apps/web/src/components/landing/copy.test.ts`

**Interfaces:**
- Produces: `export const copy` (tipado) + `export type LandingCopy`. Seções: `nav`, `hero` (`eyebrow`, `titleLead`, `titleAccent`, `titleTail`, `subtitle`, `ctaPrimary`, `ctaSecondary`), `features` (labels das abas + conteúdo), `bento` (título de cada conceito), `howItWorks` (3 passos), `pricing` (tagline + descrições dos 3 planos + textos de CTA), `cta` (título/subtítulo/botão), `footer` (colunas + status + copyright). Todas as strings em pt-BR. Consumido por T4–T10.

- [ ] **Step 1: Escrever o teste (falha primeiro)** — `copy.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { copy } from "./copy";

describe("landing copy", () => {
  it("tem todas as seções e nenhuma string vazia", () => {
    for (const section of ["nav", "hero", "features", "bento", "howItWorks", "pricing", "cta", "footer"] as const) {
      expect(copy[section]).toBeTruthy();
    }
    const flat = JSON.stringify(copy);
    expect(flat).not.toMatch(/""/); // nenhuma string vazia
  });

  it("hero tem headline em 3 partes e 2 CTAs", () => {
    expect(copy.hero.titleAccent.length).toBeGreaterThan(0);
    expect(copy.hero.ctaPrimary.length).toBeGreaterThan(0);
    expect(copy.hero.ctaSecondary.length).toBeGreaterThan(0);
  });

  it("não menciona planos/textos falsos removidos", () => {
    const flat = JSON.stringify(copy).toLowerCase();
    expect(flat).not.toContain("team");
    expect(flat).not.toContain("10 daily");
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**
Run: `bun --filter @dailify/web test copy`
Expected: FAIL (`copy` não existe).

- [ ] **Step 3: Escrever `copy.ts`**
Objeto `const copy = { ... } as const` (o `as const` é permitido) com todas as strings pt-BR das seções acima, seguindo os textos do doc (alma "o seu dia, projetado", planos reais, footer honesto). Derivar `export type LandingCopy = typeof copy;`. Exemplo de forma (preencher todas):
```ts
export const copy = {
  hero: {
    eyebrow: "// ORGANIZE SEU DIA",
    titleLead: "O seu dia,",
    titleAccent: "sem esforço",
    titleTail: "",
    subtitle: "Tarefas, horários e recorrência num só lugar — projetados pra você só executar.",
    ctaPrimary: "Começar — é grátis",
    ctaSecondary: "Ver como funciona",
  },
  // nav, features, bento, howItWorks, pricing, cta, footer...
} as const;
```

- [ ] **Step 4: Rodar o teste (deve passar)**
Run: `bun --filter @dailify/web test copy`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/components/landing/copy.ts apps/web/src/components/landing/copy.test.ts
git commit -m "feat(web): pt-BR landing copy dictionary (i18n-ready) + test"
```

---

### Task 4: Hero com painel flutuante (`hero.tsx`)

**Files:**
- Create: `apps/web/src/components/landing/hero.tsx`

**Interfaces:**
- Consumes: `copy.hero` (T3), tokens (T1), `Button` (`components/ui/button`), `framer-motion`.
- Produces: `export function Hero(): JSX.Element`.

- [ ] **Step 1: Implementar o Hero**
Layout 2 colunas (`grid md:grid-cols-2`), gutters `px-[clamp(1rem,5vw,24rem)]`, `py-20+`. **Esquerda:** eyebrow mono (`font-mono text-xs uppercase text-muted-foreground tracking-[0.04em]`) = `copy.hero.eyebrow`; headline `font-sans` grande (`text-5xl sm:text-6xl`), tracking negativo (`tracking-[-0.03em]`), com `copy.hero.titleAccent` em `text-accent-primary`; subtitle `text-secondary`; 2 botões — primário `bg-accent-primary hover:bg-accent-hover` + secundário ghost (`bg-transparent border hover:bg-surface-hover`). **Direita:** painel-mock **presentational** do day-view (NÃO acoplar ao `daily-tasks.tsx` real, que exige auth/dados — construir um mock fiel: header com 3 dots + toggle tema, mini-calendário, linhas de tarefa com horário/badge de duração). Painel: `bg-surface-panel border rounded-panel shadow-panel`, leve `[transform:perspective(1200px)_rotateY(-6deg)]`. **Animação de entrada** (`whileInView`, `viewport={{ once: true }}`): a coluna de horas aparece, os blocos de tarefa entram em `staggerChildren`, a **linha "agora"** (`bg-accent-primary`, com `shadow-[…accent-glow…]` via token) faz `pulse` em loop, a célula "hoje" acende. **Parallax** no scroll: `useScroll` + `useTransform` movendo o painel em Y sutilmente. **`useReducedMotion()`** → tudo estático no estado final, sem pulso/stagger/parallax. Cena detalhada no doc § "Hero — o painel de produto que se monta".

- [ ] **Step 2: Verificar**
Run: `bun --filter @dailify/web check`
Expected: PASS. Render: hero legível em dark e light (togglar tema); entrada anima uma vez; reduced-motion → estático.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/landing/hero.tsx
git commit -m "feat(web): landing hero with animated floating day-view panel"
```

---

### Task 5: Switcher de features tipo aba-navegador (`feature-tabs.tsx`)

**Files:**
- Create: `apps/web/src/components/landing/feature-tabs.tsx`

**Interfaces:**
- Consumes: `copy.features` (T3), `components/ui/tabs` (Radix wrapper, já existe), `framer-motion` (`LayoutGroup`, `motion`, `AnimatePresence`), tokens.
- Produces: `export function FeatureTabs(): JSX.Element`.

- [ ] **Step 1: Implementar o switcher**
Painel grande `bg-surface-panel border border-highlight rounded-panel shadow-panel`. No topo, uma fileira de abas-pasta (Radix `Tabs`/`TabsList`/`TabsTrigger`): cada trigger = ícone lucide pequeno + label **mono uppercase** (ex: `DAY`, `CALENDÁRIO`, `RECORRÊNCIA`, `VOZ`). A aba ativa compartilha o fundo do painel (sem costura). O **realce deslizante** entre abas usa `layoutId="tab-active"` dentro de `<LayoutGroup>` (motion.div posicionado atrás do trigger ativo). O corpo (`TabsContent`) troca com `AnimatePresence` (crossfade + slide leve). Cada conteúdo = um mock presentational daquela superfície (mês / dia / recorrência / voz — pode reaproveitar visualmente o mock do Hero, variando). `useReducedMotion()` → troca instantânea (sem slide). Cena no doc § "Switcher de superfícies".

- [ ] **Step 2: Verificar**
Run: `bun --filter @dailify/web check`
Expected: PASS. Render: clicar abas move o realce suavemente e troca o conteúdo; teclado (Radix) navega; reduced-motion → sem slide.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/landing/feature-tabs.tsx
git commit -m "feat(web): browser-tab style feature switcher (Radix Tabs + layoutId)"
```

---

### Task 6: Cenas-conceito de TEMPO (`scenes.tsx`)

**Files:**
- Create: `apps/web/src/components/landing/scenes.tsx`

**Interfaces:**
- Consumes: tokens, `framer-motion`.
- Produces (6 componentes presentational, SVG/CSS, crimson+neutro, cada um `useReducedMotion`-aware): `SceneCalendar`, `SceneHours`, `ScenePriority`, `SceneRecurrence`, `SceneVoice`, `SceneReminders`. Cada um aceita `className` opcional e preenche seu container.

- [ ] **Step 1: Implementar as 6 cenas**
Cada uma segue a descrição do doc § "Bento de conceitos — cenas de TEMPO", em SVG inline / CSS, usando **só** `currentColor`/tokens (crimson via `text-accent-primary`, neutro via `text-muted-foreground`/`border`):
- `SceneCalendar` — mini-grid do mês, célula "hoje" crimson, ticks de tarefa; sweep suave.
- `SceneHours` — coluna-timeline com marcas de hora, blocos encaixados, linha "agora" crimson.
- `ScenePriority` — pilha de barras reordenando por peso, topo crimson.
- `SceneRecurrence` — loop circular com nó orbitando + ghosts (labels mono Daily/Weekly/Monthly).
- `SceneVoice` — waveform crimson resolvendo em 2 linhas de tarefa (herói).
- `SceneReminders` — sino/relógio + anel crimson pulsando no offset numa mini-timeline.
Animações sutis (`whileInView` once) e `useReducedMotion()` → estado final estático. **Alternativa simplificada** permitida (wireframe geométrico) se alguma ficar pesada — manter a história.

- [ ] **Step 2: Verificar**
Run: `bun --filter @dailify/web check`
Expected: PASS. Render numa página de teste ou direto no bento (T7): cada cena legível em dark/light; reduced-motion estático.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/landing/scenes.tsx
git commit -m "feat(web): 6 TIME concept SVG scenes for feature bento"
```

---

### Task 7: Bento de features (`feature-bento.tsx`)

**Files:**
- Create: `apps/web/src/components/landing/feature-bento.tsx`

**Interfaces:**
- Consumes: `scenes.tsx` (T6), `copy.bento` (T3), tokens, `framer-motion`.
- Produces: `export function FeatureBento(): JSX.Element`.

- [ ] **Step 1: Implementar o bento**
Grade assimétrica (CSS grid) onde a célula **Voz** ocupa 2× (largura ou altura) e tem `bg-accent-subtle` de fundo; as outras 5 preenchem ao redor. Cada célula = `bg-surface-card border rounded-card` + a `Scene*` correspondente ocupando o topo/fundo + título (`copy.bento.*`) e 1 linha de apoio. Reveal em `whileInView` com `staggerChildren`. `useReducedMotion` → sem stagger. Layout responsivo (empilha no mobile). Cena/hierarquia no doc § "Bento de conceitos".

- [ ] **Step 2: Verificar**
Run: `bun --filter @dailify/web check`
Expected: PASS. Render: bento coeso, Voz em destaque, uma só cor viva; reduzido para 1 coluna no mobile.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/landing/feature-bento.tsx
git commit -m "feat(web): asymmetric feature bento (voice as hero cell)"
```

---

### Task 8: "Como funciona" — timeline de 3 passos (`how-it-works.tsx`)

**Files:**
- Create: `apps/web/src/components/landing/how-it-works.tsx`

**Interfaces:**
- Consumes: `copy.howItWorks` (T3), tokens, `framer-motion`.
- Produces: `export function HowItWorks(): JSX.Element`.

- [ ] **Step 1: Implementar**
3 passos `[01] [02] [03]` (números **mono**) ligados por uma **linha-timeline horizontal** (o motivo da coluna do dia, deitado; `border`/`bg-border`). Um ponto crimson percorre a linha conforme o scroll (`useScroll` + `useTransform` no `scaleX`/`x`). Cada passo = número mono + título + descrição (`copy.howItWorks`). `useReducedMotion` → ponto estático. Doc § "Como funciona".

- [ ] **Step 2: Verificar**
Run: `bun --filter @dailify/web check`
Expected: PASS. Render: 3 passos alinhados na linha; ponto avança no scroll; reduced-motion ok.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/components/landing/how-it-works.tsx
git commit -m "feat(web): how-it-works 3-step timeline"
```

---

### Task 9: Pricing — 3 planos reais (`pricing.tsx`)

**Files:**
- Create: `apps/web/src/components/landing/pricing.tsx`
- Create: `apps/web/src/components/landing/pricing.test.ts`

**Interfaces:**
- Consumes: `PLAN_PERMISSIONS` + `PLAN_ID` de `@dailify/shared`, `planMap` de `consts/conts`, `copy.pricing` (T3), tokens, `Link`/`Button`.
- Produces: `export function Pricing(): JSX.Element` + helper puro `export function planFeatures(role): string[]` (deriva bullets de `PLAN_PERMISSIONS` — ex: "30 tarefas/mês", "Tarefas ilimitadas", "Recorrência", "Criação por voz").

- [ ] **Step 1: Escrever o teste do helper (falha primeiro)** — `pricing.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { planFeatures } from "./pricing";

describe("planFeatures", () => {
  it("Free = 30/mês, sem recorrência, sem voz", () => {
    const f = planFeatures("free").join(" | ").toLowerCase();
    expect(f).toContain("30");
    expect(f).not.toContain("ilimitad");
    expect(f).not.toContain("voz");
  });
  it("Pro = ilimitado + recorrência, sem voz", () => {
    const f = planFeatures("pro").join(" | ").toLowerCase();
    expect(f).toContain("ilimitad");
    expect(f).toContain("recorr");
    expect(f).not.toContain("voz");
  });
  it("Pro+AI = inclui voz", () => {
    expect(planFeatures("pro+ai").join(" | ").toLowerCase()).toContain("voz");
  });
});
```

- [ ] **Step 2: Rodar (deve falhar)**
Run: `bun --filter @dailify/web test pricing`
Expected: FAIL (`planFeatures` não existe).

- [ ] **Step 3: Implementar `pricing.tsx`**
`planFeatures(role)` lê `PLAN_PERMISSIONS[role]` (`taskLimits.monthly` -1=ilimitado, `taskLimits.recurring`, `features.voiceCreation`) e retorna os bullets em pt-BR. O componente `Pricing` renderiza 3 cards (`free`/`pro`/`pro+ai` via `PLAN_ID`), rótulos de `planMap`, bullets de `planFeatures`, **crimson só no recomendado** (Pro+AI: borda `border-accent-primary` + badge mono `bg-accent-subtle text-accent-primary` "RECOMENDADO"). Preços: usar `copy.pricing` (marketing) — NÃO hard-codar número de plano/limite (limites vêm do helper). CTA de cada card → `<Link to="/premium">` (ou `/login`). Cards limpos (`bg-surface-card border rounded-card`), sem cena pesada.

- [ ] **Step 4: Rodar (deve passar)**
Run: `bun --filter @dailify/web test pricing`
Expected: PASS.

- [ ] **Step 5: Verificar build**
Run: `bun --filter @dailify/web check`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/components/landing/pricing.tsx apps/web/src/components/landing/pricing.test.ts
git commit -m "feat(web): honest pricing (Free/Pro/Pro+AI derived from PLAN_PERMISSIONS)"
```

---

### Task 10: CTA + footer que dissolve (`cta.tsx`, `site-footer.tsx`)

**Files:**
- Create: `apps/web/src/components/landing/cta.tsx`
- Create: `apps/web/src/components/landing/site-footer.tsx`

**Interfaces:**
- Consumes: `copy.cta` / `copy.footer` (T3), tokens, `Link`.
- Produces: `export function CtaBand()`, `export function SiteFooter()`.

- [ ] **Step 1: Implementar `CtaBand`**
Faixa final `bg-accent-primary text-primary-foreground` (o único bloco de cor sólida, intencional): título + subtítulo + botão branco. `copy.cta`.

- [ ] **Step 2: Implementar `SiteFooter` (dissolve)**
O footer **emerge do escuro**: `bg-surface-page`, cantos superiores arredondados grandes (`rounded-t-[var(--radius-panel)]` ou maior), uma **máscara de gradiente** no topo (`mask-image` linear) + o grão compartilhado bleeding, de modo que a borda superior se dissolva na seção acima. Colunas de links **honestas** (`copy.footer` — só Produto: Features/Pricing; Legal: Privacidade→`/privacidade`, Termos→`/termos`; redes reais se houver). Linha **status mono** (ex: `DAILIFY // 2026 · feito no Brasil`). Copyright **© 2026**. Remover ícones/links de redes falsos se não existirem contas reais. Doc § "Footer que dissolve".

- [ ] **Step 3: Verificar**
Run: `bun --filter @dailify/web check`
Expected: PASS. Render: transição CTA→footer sem corte seco; só links reais; © 2026.

- [ ] **Step 4: Commit**
```bash
git add apps/web/src/components/landing/cta.tsx apps/web/src/components/landing/site-footer.tsx
git commit -m "feat(web): CTA band + dissolving honest footer"
```

---

### Task 11: Compor `landingPage.tsx` + limpeza + varredura final

**Files:**
- Modify: `apps/web/src/pages/landingPage.tsx` (substituir corpo pela composição)
- Delete (se não usados em outro lugar): `apps/web/public/blob_10_blur.png`, `apps/web/public/blobs-bottom.*.jpg` (confirmar com grep antes)

**Interfaces:**
- Consumes: `Header`, `Grain`, `Hero`, `FeatureTabs`, `FeatureBento`, `HowItWorks`, `Pricing`, `CtaBand`, `SiteFooter`.

- [ ] **Step 1: Reescrever `landingPage.tsx`** como composição fina
```tsx
export default function LandingPage() {
  return (
    <main className="relative flex flex-col w-full bg-surface-page text-foreground overflow-x-clip">
      <Grain />
      <Header className="px-[clamp(1rem,5vw,24rem)]" />
      <Hero />
      <FeatureTabs />
      <FeatureBento />
      <HowItWorks />
      <Pricing />
      <CtaBand />
      <SiteFooter />
    </main>
  );
}
```
Remover todo o markup antigo (blobs, cards genéricos, depoimentos, pricing "Team", footer com links-fantasma). Conteúdo (`z-10`) acima do `<Grain />` (`z-0`).

- [ ] **Step 2: Confirmar assets órfãos e remover**
```bash
grep -rn "blob_10_blur\|blobs-bottom" apps/web/src && echo "AINDA USADO — não apagar" || rm -f apps/web/public/blob_10_blur.png apps/web/public/blobs-bottom.*.jpg
```

- [ ] **Step 3: Varredura de conteúdo verdadeiro**
Confirmar que a página renderizada NÃO contém: "Team", "$12", "10 daily tasks", nomes de depoimentos ("Sarah Johnson" etc.), links "Blog/API Documentation/Careers/Integrations/Changelog/Help Center/Tutorials/About Us", "© 2025".
```bash
grep -rniE "team|10 daily|sarah johnson|miguel rodriguez|aisha patel|api documentation|© 2025|blog|careers" apps/web/src/pages/landingPage.tsx apps/web/src/components/landing/ || echo "limpo"
```

- [ ] **Step 4: Varredura de acessibilidade/reduced-motion**
No devtools, "Emulate prefers-reduced-motion: reduce" → confirmar que hero, grão, bento, timeline e tabs ficam estáticos (sem loops). Togglar tema light/dark → landing legível nos dois.

- [ ] **Step 5: Gate completo**
Run: `bun run check`
Expected: PASS (web + shared + server; a mudança é só web). Rodar `bun run dev:front` e navegar a página inteira uma vez.

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/pages/landingPage.tsx
git commit -m "feat(web): compose redesigned landing + remove legacy blobs/fake content"
```

---

## Self-Review

**Spec coverage** (doc → task):
- Alma / dark-first / crimson único → Global Constraints + T1.
- Geist + mono → T1. · Grão vivo → T2. · Copy pt-BR i18n-ready → T3.
- Hero flutuante animado → T4. · Switcher aba-navegador → T5. · Bento conceitos-TEMPO → T6+T7.
- Como funciona → T8. · Pricing verdadeiro → T9. · CTA + footer dissolve → T10.
- Composição + limpeza + conteúdo verdadeiro + reduced-motion → T11.
- Motion primitives (whileInView/useScroll/layoutId/useReducedMotion) → distribuídos (T2,T4,T5,T6,T7,T8).
- Tokens/overrides shadcn → T1 + aplicados por task.
- **Gap conhecido/aceito:** o Header é compartilhado com outras páginas (privacy/terms/premium); NÃO é restilizado aqui para evitar scope creep — fica como follow-up se necessário.

**Placeholder scan:** sem "TBD/TODO"; cada task tem arquivos, interfaces e verificação reais. Cenas SVG referenciam specs detalhadas do doc (fonte da verdade) em vez de duplicar 6 blocos grandes de SVG aqui — decisão deliberada (o doc é normativo e o identity-prompt proíbe código-pronto pra copiar nas cenas).

**Type consistency:** nomes estáveis entre tasks — `copy` (T3) consumido por T4–T10; `Grain` (T2); `Scene*` (T6) → `FeatureBento` (T7); `planFeatures(role)` (T9). Classes de token (T1) usadas por todas.

**Verificação:** honesta ao projeto — build/lint/visual/reduced-motion como gate; vitest só em T3 e T9 (lógica pura).
