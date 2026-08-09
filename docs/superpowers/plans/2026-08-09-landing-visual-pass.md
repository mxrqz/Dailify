# Landing — passe visual: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar à landing uma escada de superfície por seção, restringir o crimson a ação/estado ativo, e corrigir o buraco de 245px no hero.

**Architecture:** Nenhuma lógica nova. Um token de superfície (`--surface-raised`), uma ponte de tema (`.light { color-scheme: light }`) e um utility de ritmo (`section-y`) em `apps/web/src/global.css`; o resto é troca de classes nos seis componentes de seção da landing. A laje clara do pricing funciona porque os tokens do projeto são `light-dark()` resolvidos no ponto de uso — invertem por subtree com uma classe.

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind v4 (`@theme inline`, `@utility`), bun. Verificação visual com `playwright-core` + `/usr/bin/chromium` contra o dev server.

**Spec:** `docs/superpowers/specs/2026-08-09-landing-visual-pass-design.md`
**Issue bd:** `Dailify-a3s` (claim com `bd update Dailify-a3s --claim` antes de começar)

## Global Constraints

- **Sem `as`.** Type assertions são warning no ESLint; não introduzir novas. `as const` é permitido.
- **Sem hex nem cor arbitrária em componente.** Toda cor sai de token em `global.css` mapeado via `@theme inline`. Cor nova = token novo + mapeamento.
- **Tokens são declarados uma vez** com `light-dark(claro, escuro)` em `oklch`. Não duplicar por tema, não usar `display-p3`.
- **Preferir cor sólida a `/opacity`** em elementos interativos.
- **Prettier, `printWidth: 100`.** Rodar `bun --filter @dailify/web format` antes de cada commit.
- **Gate completo:** `bun run check` (format + lint + typecheck + os 3 suites de teste) precisa passar em todo commit.
- **Não dar `git push`.** O usuário controla o push; commitar apenas.
- **Não tocar** em `task-card.tsx` nem `task-options.tsx` — são mocks da UI do produto, o crimson ali é intencional.
- **Fora de escopo:** redesenho da timeline `01/02/03`, acento secundário, responsivo/mobile.

## Sobre testes neste plano

Não há lógica nova para cobrir com vitest, e escrever unit test para nome de classe CSS testaria o
Tailwind, não o produto. A verificação de cada task é uma dupla:

1. `bun run build` + `grep` no CSS emitido — prova que o Tailwind gerou o que se pediu.
2. Um probe Playwright que lê **estilo computado** na página rodando — prova que o pixel mudou.

O probe é criado na Task 1 e reusado por todas as outras. Ele mora no scratchpad, não no repo: é
ferramenta de verificação deste passe, não suite de CI (precisa de dev server e browser).

**Pré-requisito para todas as tasks:** dev server rodando em `https://localhost:1420` (`bun run dev`).
Confirmar com `curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:1420/` → `200`.

**Convenção de caminho:** `$SCRATCH` abaixo é o diretório de scratchpad da sessão. Se estiver
executando numa sessão nova, use qualquer diretório temporário fora do repo e mantenha o mesmo para
todas as tasks.

---

### Task 1: Fundação — token `--surface-raised`, classe `.light`, e o probe

**Files:**
- Modify: `apps/web/src/global.css` (bloco de tokens ~linha 77-97; `@theme inline` ~linha 174-190; ponte `.dark` ~linha 109-111)
- Create: `$SCRATCH/probe.ts`
- Create: `$SCRATCH/package.json` (via `bun add playwright-core`)

**Interfaces:**
- Consumes: nada.
- Produces: o token CSS `--surface-raised` → utility `bg-surface-raised`; a classe `.light`; e `$SCRATCH/probe.ts`, que imprime um relatório JSON com as chaves `secoes[]` (`{ rotulo, bg }`), `heroGap` (número, px) e `crimson[]` (`{ tag, texto, prop }`). As tasks seguintes leem essas chaves.

- [ ] **Step 1: Instalar o playwright-core no scratchpad**

```bash
cd "$SCRATCH" && bun add playwright-core
```

Os browsers já estão em `~/.cache/ms-playwright`, mas o probe usa o chromium do sistema
(`/usr/bin/chromium`), então não há download.

- [ ] **Step 2: Escrever o probe**

Criar `$SCRATCH/probe.ts`:

```ts
import { chromium } from "playwright-core";

const CRIMSON = ["oklch(0.586 0.222 17.6)", "oklch(0.54 0.222 17.6)"];

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await ctx.newPage();
await page.goto("https://localhost:1420/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);

const report = await page.evaluate((crimson: string[]) => {
  // Cada <section> se identifica pelo primeiro heading que contiver, pra não depender de índice.
  const secoes = [...document.querySelectorAll("main section")].map((el) => {
    const h = el.querySelector("h1, h2");
    return {
      rotulo: h?.textContent?.trim().slice(0, 28) ?? "(sem heading)",
      bg: getComputedStyle(el).backgroundColor,
    };
  });

  // Vão vertical no hero: base do parágrafo do subtítulo até o topo dos botões.
  const heroSec = document.querySelector("main section");
  // `h1 + p` e não `p` solto: a Task 6 move o eyebrow pra cima do h1, e um seletor de
  // primeiro-parágrafo passaria a medir eyebrow→botão em vez de subtítulo→botão — a métrica
  // cresceria em vez de encolher. O subtítulo é irmão adjacente do h1 antes e depois.
  const p = heroSec?.querySelector("h1 + p");
  const btn = heroSec?.querySelector("button, a[role='button']");
  const heroGap =
    p && btn ? Math.round(btn.getBoundingClientRect().top - p.getBoundingClientRect().bottom) : -1;

  // Onde o crimson aparece, e em qual propriedade.
  const crimsonUsos: { tag: string; texto: string; prop: string }[] = [];
  for (const el of document.querySelectorAll("main *")) {
    const cs = getComputedStyle(el);
    for (const prop of ["color", "backgroundColor", "borderTopColor", "borderLeftColor"]) {
      const v = cs.getPropertyValue(
        prop.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()),
      );
      if (crimson.some((c) => v === c)) {
        crimsonUsos.push({
          tag: el.tagName.toLowerCase(),
          texto: (el.textContent ?? "").trim().slice(0, 24),
          prop,
        });
      }
    }
  }

  return { secoes, heroGap, crimson: crimsonUsos };
}, CRIMSON);

console.log(JSON.stringify(report, null, 2));
await browser.close();
```

- [ ] **Step 3: Rodar o probe e registrar o estado ANTES**

```bash
cd "$SCRATCH" && bun probe.ts > antes.json && cat antes.json
```

Esperado — este é o defeito que o passe conserta:
- todas as entradas de `secoes[].bg` iguais ou `rgba(0, 0, 0, 0)` (nenhuma seção pinta superfície própria);
- `heroGap` em torno de **214** (o ~245 que eu tinha estimado veio de ler coordenada em
  screenshot; o valor do DOM é 214 — use o que o probe imprimir, não a estimativa);
- `crimson[]` com bem mais de 6 entradas.

Guardar `antes.json`; as tasks seguintes comparam contra ele.

- [ ] **Step 4: Adicionar o token**

Em `apps/web/src/global.css`, logo depois da linha de `--surface-panel`:

```css
  --surface-raised: light-dark(
    oklch(98% 0 0),
    oklch(17.5% 0 0)
  ); /* dark = degrau de SEÇÃO; cards em cima usam surface-panel (19.5%) */
```

E no bloco `@theme inline`, junto dos outros `--color-surface-*`:

```css
  --color-surface-raised: var(--surface-raised);
```

- [ ] **Step 5: Adicionar a ponte `.light`**

Logo abaixo do bloco `.dark { color-scheme: dark; }` que já existe:

```css
/* Contraparte do bridge acima: inverte um subtree pro tema claro dentro de uma página dark
   (a laje de preços). Como os tokens são light-dark() resolvidos no ponto de uso, texto, bordas
   e superfícies do subtree flipam junto — exceto --surface-ink, que é sempre escuro por projeto. */
.light {
  color-scheme: light;
}
```

- [ ] **Step 6: Verificar que o Tailwind emitiu tudo**

```bash
bun --filter @dailify/web format && bun run build 2>&1 | grep -iE "error|Exited"
grep -c "surface-raised" apps/web/dist/assets/*.css
grep -o "\.light{color-scheme:light}" apps/web/dist/assets/*.css
```

Esperado: `Exited with code 0`, contagem ≥ 1, e a regra `.light{color-scheme:light}` presente.

- [ ] **Step 7: Verificar o flip por subtree na página**

```bash
cd "$SCRATCH" && bun -e '
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const p = await (await b.newContext({ ignoreHTTPSErrors: true })).newPage();
await p.goto("https://localhost:1420/", { waitUntil: "networkidle" });
console.log(await p.evaluate(() => {
  const el = document.createElement("div");
  el.className = "light";
  el.style.background = "var(--surface-page)";
  document.body.append(el);
  const claro = getComputedStyle(el).backgroundColor;
  el.className = "";
  const escuro = getComputedStyle(el).backgroundColor;
  el.remove();
  const r = document.createElement("div");
  r.style.background = "var(--surface-raised)";
  document.body.append(r);
  const raised = getComputedStyle(r).backgroundColor;
  r.remove();
  return { escuro, claro, raised };
}));
await b.close();'
```

Esperado: `escuro: "oklch(0.145 0 0)"`, `claro: "oklch(1 0 0)"`, `raised: "oklch(0.175 0 0)"`.

- [ ] **Step 8: Rodar o gate e commitar**

```bash
bun run check 2>&1 | grep -iE "✖|Exited"
git add apps/web/src/global.css
git commit -m "feat(web): token --surface-raised e ponte .light

Degrau de superfície para seção (17.5% L), com a regra de que cards ficam
~2 pontos acima da seção que os hospeda. A classe .light é a contraparte
do bridge .dark: inverte um subtree pro tema claro dentro da página dark.

Refs: Dailify-a3s"
```

Esperado do gate: `0 errors` (os ~43 warnings são pré-existentes) e `Exited with code 0` nos 3 pacotes.

---

### Task 2: Ritmo — `@utility section-y`

Refatoração pura: **o visual não pode mudar**. Isso é o critério de aceite.

**Files:**
- Modify: `apps/web/src/global.css` (perto do `@utility px-gutter`, ~linha 232)
- Modify: `apps/web/src/components/landing/hero.tsx:22`
- Modify: `apps/web/src/components/landing/feature-tabs.tsx:57`
- Modify: `apps/web/src/components/landing/feature-bento.tsx:66`
- Modify: `apps/web/src/components/landing/how-it-works.tsx:24`
- Modify: `apps/web/src/components/landing/pricing.tsx:66`
- Modify: `apps/web/src/components/landing/cta.tsx:36`

**Interfaces:**
- Consumes: nada da Task 1.
- Produces: a classe `section-y` (`padding-block` 5rem, 7rem no `md`), usada como ritmo padrão de seção pelas tasks seguintes.

- [ ] **Step 1: Capturar a geometria baseline**

Comparar screenshot byte-a-byte **não** serve aqui: a landing tem a palavra em rodízio no subtítulo
(`useCycle`, 7s) e o grain animado no fechamento, então dois runs nunca são idênticos. O que precisa
ficar igual é a **caixa** de cada seção.

```bash
cd "$SCRATCH" && bun -e '
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })).newPage();
await p.goto("https://localhost:1420/", { waitUntil: "networkidle" });
console.log(JSON.stringify(await p.evaluate(() =>
  [...document.querySelectorAll("main section")].map((el) => {
    const r = el.getBoundingClientRect();
    return { h: Math.round(r.height), pt: getComputedStyle(el).paddingTop, pb: getComputedStyle(el).paddingBottom };
  })), null, 2));
await b.close();' > geo-antes.json && cat geo-antes.json
```

Guardar `geo-antes.json`. Também capturar os screenshots para olho humano:

```bash
cd "$SCRATCH" && bun shot.ts
```

Se `shot.ts` não existir no scratchpad, criar com este conteúdo:

```ts
import { chromium } from "playwright-core";

const OUT = import.meta.dir;
const W = 1440;
const H = 900;

const browser = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  ignoreHTTPSErrors: true,
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto("https://localhost:1420/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/full.png`, fullPage: true });

const total = await page.evaluate(() => document.body.scrollHeight);
const steps = Math.min(Math.ceil(total / H), 14);
for (let i = 0; i < steps; i++) {
  await page.evaluate((y) => window.scrollTo(0, y), i * H);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/s${String(i).padStart(2, "0")}.png` });
}
console.log(`altura ${total}px · ${steps} telas`);
await browser.close();
```

- [ ] **Step 2: Criar o utility**

Em `apps/web/src/global.css`, logo depois do bloco `@utility px-gutter`:

```css
/*
 * Ritmo vertical de seção. Estava hardcoded como `py-20 md:py-28` em cinco das seis seções da
 * landing — o hero é a exceção, com `pt-20` e altura fixa. Centralizar aqui torna o respiro da
 * página inteira ajustável numa linha. O valor é o mesmo de antes: refator, não mudança de layout.
 */
@utility section-y {
  padding-block: --spacing(20);
  @variant md {
    padding-block: --spacing(28);
  }
}
```

- [ ] **Step 3: Verificar que o Tailwind aceitou a sintaxe**

```bash
bun run build 2>&1 | grep -iE "error|Exited"
```

Esperado: `Exited with code 0`.

**Não grepar o CSS emitido ainda.** O Tailwind v4 faz tree-shake de `@utility` que ninguém usa, então
`.section-y` só aparece no bundle depois do Step 4 — grepar aqui volta vazio e parece erro de
sintaxe quando não é. A conferência da regra emitida está no Step 5.

Se o build reclamar de `@variant` dentro de `@utility`, trocar o bloco por:

```css
@utility section-y {
  padding-block: --spacing(20);
}

@media (width >= 48rem) {
  .section-y {
    padding-block: --spacing(28);
  }
}
```

- [ ] **Step 4: Trocar as seis seções**

Em cada arquivo, substituir `py-20 md:py-28` por `section-y`:

- `feature-tabs.tsx:57` → `<section className="w-full px-gutter section-y">`
- `feature-bento.tsx:66` → `<section className="px-gutter section-y">`
- `how-it-works.tsx:24` → `<section className="px-gutter section-y">`
- `pricing.tsx:66` → `<section className="px-gutter section-y">`
- `cta.tsx:36` → `<section className="section-y text-center">`

O hero é o único que não usa `py-20 md:py-28` — ele tem `pt-20` e altura fixa. **Não mexer no hero
nesta task**; ele é tratado na Task 6.

- [ ] **Step 5: Conferir a regra emitida e provar que a geometria não mudou**

Agora que a classe está em uso, ela existe no bundle:

```bash
bun run build >/dev/null 2>&1 && grep -o "\.section-y{[^}]*}" apps/web/dist/assets/*.css
```

Esperado: `padding-block` resolvendo para `5rem` (`calc(var(--spacing) * 20)` também serve — é a
forma que o Tailwind v4 emite), mais a variante `md` dentro de um `@media (min-width: 48rem)`.

Depois, rodar o mesmo comando do Step 1, gravando em `geo-depois.json`, e comparar:

```bash
cd "$SCRATCH" && bun -e '
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true })).newPage();
await p.goto("https://localhost:1420/", { waitUntil: "networkidle" });
console.log(JSON.stringify(await p.evaluate(() =>
  [...document.querySelectorAll("main section")].map((el) => {
    const r = el.getBoundingClientRect();
    return { h: Math.round(r.height), pt: getComputedStyle(el).paddingTop, pb: getComputedStyle(el).paddingBottom };
  })), null, 2));
await b.close();' > geo-depois.json
diff geo-antes.json geo-depois.json && echo "GEOMETRIA IDÊNTICA" || echo "MUDOU — investigar"
```

Esperado: `GEOMETRIA IDÊNTICA` (`padding-top`/`padding-bottom` de `80px` em cada seção, `112px` a
partir de `md`; o hero é a exceção e não deve ter mudado porque não foi tocado nesta task).

Se der `MUDOU`, a causa mais provável é `--spacing(20)` não resolver para `5rem`; conferir com
`grep -o "\.section-y{[^}]*}" apps/web/dist/assets/*.css` e comparar com o `py-20` original
(`padding-block: 5rem`).

- [ ] **Step 6: Gate e commit**

```bash
bun --filter @dailify/web format && bun run check 2>&1 | grep -iE "✖|Exited"
git add apps/web/src/global.css apps/web/src/components/landing/
git commit -m "refactor(web): ritmo de seção da landing vira @utility section-y

py-20 md:py-28 estava hardcoded em seis arquivos. Mesmo valor, um lugar só.
Screenshot full-page idêntico antes/depois.

Refs: Dailify-a3s"
```

---

### Task 3: Tom `raised` nas seções Tabs e Como funciona

**Files:**
- Modify: `apps/web/src/components/landing/feature-tabs.tsx:57` (raiz) e `:96` (pills)
- Modify: `apps/web/src/components/landing/how-it-works.tsx:24` (raiz) e `:49` (chips)

**Interfaces:**
- Consumes: `bg-surface-raised` (Task 1), `section-y` (Task 2).
- Produces: duas seções com superfície própria; estabelece o padrão "seção raised + hairline" que a Task 4 repete com `.light`.

- [ ] **Step 1: Pintar as duas seções**

`feature-tabs.tsx:57`:

```tsx
    <section className="w-full border-y border-surface-line bg-surface-raised px-gutter section-y">
```

`how-it-works.tsx:24`:

```tsx
    <section className="border-y border-surface-line bg-surface-raised px-gutter section-y">
```

O `border-y` é o hairline de troca de tom — o hero já usa `border-b`, então é o padrão da casa.

- [ ] **Step 2: Subir os filhos que ficariam abaixo da própria seção**

Os dois usam `bg-surface-card` (16.8% L), que agora estaria **abaixo** da seção (17.5%), invertendo a
elevação. Trocar para `bg-surface-panel` (19.5%).

`how-it-works.tsx:49` — o `bg-surface-card` vira `bg-surface-panel`:

```tsx
              <span className="relative z-10 flex size-12 items-center justify-center rounded-full border bg-surface-panel font-mono text-sm text-accent-primary">
```

`feature-tabs.tsx:96` — só o trecho `data-[state=inactive]:bg-surface-card` vira
`data-[state=inactive]:bg-surface-panel`. O resto da string de classes fica igual.

- [ ] **Step 3: Confirmar que não sobrou nenhum `surface-card` nessas duas seções**

```bash
grep -n "surface-card" apps/web/src/components/landing/feature-tabs.tsx apps/web/src/components/landing/how-it-works.tsx
```

Esperado: nenhuma saída. Se aparecer algo, trocar para `surface-panel` também — a regra é que dentro
de uma seção `raised` nenhum filho pode usar `surface-card`.

- [ ] **Step 4: Verificar os tons computados**

```bash
cd "$SCRATCH" && bun probe.ts > depois-task3.json && grep -A2 '"rotulo"' depois-task3.json
```

Esperado: as entradas de `secoes[]` correspondentes a Tabs e "Do jeito mais simples possível" com
`bg: "oklch(0.175 0 0)"`; hero e bento seguem transparentes/`oklch(0.145 0 0)`.

- [ ] **Step 5: Olhar o resultado**

```bash
cd "$SCRATCH" && bun shot.ts
```

Abrir `s01.png` e `s03.png`. Critério: as duas lajes devem se distinguir do fundo à vista. Se a
17.5% ficar invisível, subir `--surface-raised` para `oklch(19% 0 0)` em `global.css` e, nesse caso,
subir os filhos de `surface-panel` para `surface-hover` (22.5%) para manter o delta de ~2 pontos.

- [ ] **Step 6: Gate e commit**

```bash
bun --filter @dailify/web format && bun run check 2>&1 | grep -iE "✖|Exited"
git add apps/web/src/components/landing/
git commit -m "feat(web): landing — Tabs e Como funciona viram lajes raised

Superfície própria (17.5% L) mais hairline nas trocas de tom, para o respiro
entre seções passar a pertencer a uma seção visível. Os chips 01/02/03 e as
pills inativas sobem de surface-card para surface-panel, senão ficariam
abaixo da própria seção.

Refs: Dailify-a3s"
```

---

### Task 4: Laje clara do pricing

**Files:**
- Modify: `apps/web/src/components/landing/pricing.tsx:66`

**Interfaces:**
- Consumes: `.light` (Task 1), `section-y` (Task 2).
- Produces: a única seção clara da página.

- [ ] **Step 1: Inverter a seção**

`pricing.tsx:66`:

```tsx
    <section className="light border-y border-surface-line bg-surface-page px-gutter section-y">
```

`bg-surface-page` dentro de `color-scheme: light` resolve para branco; texto, bordas, `muted` e os
cards flipam sozinhos porque todos saem de tokens `light-dark()`.

- [ ] **Step 2: Confirmar o flip**

```bash
cd "$SCRATCH" && bun probe.ts > depois-task4.json && grep -B1 -A1 "1 0 0" depois-task4.json
```

Esperado: a entrada de `secoes[]` cujo `rotulo` é "Preço simples, sem letra" com
`bg: "oklch(1 0 0)"`.

- [ ] **Step 3: Conferir contraste do crimson sobre branco**

```bash
cd "$SCRATCH" && bun shot.ts
```

Abrir `s04.png` e conferir, na seção agora clara:
- botão "Assinar Pro+AI" — texto branco sobre crimson deve continuar legível;
- borda crimson do card Pro+AI — não pode vibrar sobre o branco;
- os textos mono (`30 tarefas/mês`) — devem ter virado escuros, não sumido.

Se o crimson vibrar demais no claro, a correção é local e explícita: uma variante do botão nessa
seção, **não** mexer no token `--primary` (ele é o acento do app inteiro).

- [ ] **Step 4: Confirmar que o Grain não alcança a laje clara**

O `Grain` usa blend `screen` e só lê sobre escuro; ele vive no container do fechamento em
`landingPage.tsx:33-34`, que é irmão posterior da seção de preços. Conferir em `s04.png` que a
transição preços→CTA é limpa, sem véu claro invadindo a laje branca.

- [ ] **Step 5: Gate e commit**

```bash
bun --filter @dailify/web format && bun run check 2>&1 | grep -iE "✖|Exited"
git add apps/web/src/components/landing/pricing.tsx
git commit -m "feat(web): landing — preços viram laje clara

Uma classe: como os tokens são light-dark() resolvidos no ponto de uso,
color-scheme: light inverte a seção inteira. É o marco visual mais forte da
página e separa produto de comércio.

Refs: Dailify-a3s"
```

---

### Task 5: Disciplina do crimson

Regra: **crimson marca ação ou estado ativo. Nada mais.**

**Files:**
- Modify: `apps/web/src/components/landing/hero.tsx:40` (palavra do ciclo) e `:59` (botão)
- Modify: `apps/web/src/components/landing/how-it-works.tsx:26` (eyebrow), `:41` (ponto), `:49` (chips)
- Modify: `apps/web/src/components/landing/pricing.tsx:68` (eyebrow), `:90` (badge de economia)

**Interfaces:**
- Consumes: nada.
- Produces: estado final do crimson na landing — 6 usos, todos em ação ou estado ativo.

- [ ] **Step 1: Hero — o botão principal vira crimson**

Hoje `hero.tsx:59` é `bg-surface-card ... hover:bg-accent-hover`: a ação principal do topo não tem
cor em repouso. Trocar para:

```tsx
              className="rounded-full bg-accent-primary text-primary-foreground hover:bg-accent-hover"
```

- [ ] **Step 2: Hero — a palavra que cicla deixa de ser crimson**

`hero.tsx:40`, dentro do `cn()`: trocar `"text-accent-primary"` por `"text-foreground"`. A transição
de cor continua existindo (o rodízio ainda se vê), só não usa mais o acento:

```tsx
                      ci === activeWord ? "text-foreground" : "text-content-secondary",
```

- [ ] **Step 3: Como funciona — eyebrow, ponto e chips**

`how-it-works.tsx:26` — `text-accent-primary` vira `text-muted-foreground`:

```tsx
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
```

`how-it-works.tsx:41` — o ponto que percorre a régua perde o crimson e o glow:

```tsx
            className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-foreground"
```

`how-it-works.tsx:49` — o chip perde `text-accent-primary` (o `bg-surface-panel` da Task 3 fica):

```tsx
              <span className="relative z-10 flex size-12 items-center justify-center rounded-full border bg-surface-panel font-mono text-sm text-muted-foreground">
```

- [ ] **Step 4: Preços — eyebrow e badge de economia**

`pricing.tsx:68` — `text-accent-primary` vira `text-muted-foreground`:

```tsx
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
```

`pricing.tsx:90` — o badge de economia perde o par `bg-accent-subtle` / `text-accent-primary`:

```tsx
                <span className="rounded-full bg-surface-hover px-1.5 py-0.5 text-2xs normal-case text-foreground">
```

Manter intocados nesse arquivo: `:84` (pill ativa do toggle — estado ativo), `:110`
(`border-accent-primary` do card recomendado — alvo da ação) e o botão Assinar Pro+AI.

- [ ] **Step 5: Contar os usos restantes**

```bash
cd "$SCRATCH" && bun probe.ts > depois-task5.json && grep -c '"prop"' depois-task5.json
```

Esperado: exatamente **6** entradas em `crimson[]`, e todas devem cair em: botão do hero, botão do
fechamento, botão Assinar Pro+AI, borda do card Pro+AI, pill ativa do toggle, tab ativa.

Os mocks (`task-card.tsx`, `task-options.tsx`, linha do agora) podem somar entradas quando visíveis
na viewport — se a contagem passar de 6, conferir em `depois-task5.json` que o excedente vem de
elemento de mock antes de tratar como regressão.

- [ ] **Step 6: Gate e commit**

```bash
bun --filter @dailify/web format && bun run check 2>&1 | grep -iE "✖|Exited"
git add apps/web/src/components/landing/
git commit -m "feat(web): landing — crimson só para ação e estado ativo

Eyebrows, chips numerados, ponto da régua, badge de economia e a palavra do
rodízio no h1 passam a neutro; o CTA do hero, que era surface-card e só ficava
crimson no hover, vira crimson em repouso. Mocks do produto ficam intocados.

Refs: Dailify-a3s"
```

---

### Task 6: Hero — fechar o buraco de 245px

**Files:**
- Modify: `apps/web/src/components/landing/hero.tsx:23-72`

**Interfaces:**
- Consumes: nada.
- Produces: `heroGap` abaixo de 120px no probe.

- [ ] **Step 1: Entender a causa antes de editar**

A coluna é `grid grid-rows-3` dentro de uma `<section>` de `h-[80dvh]`: três faixas iguais de ~240px.
Faixa 1 fica vazia, faixa 2 tem o texto, faixa 3 tem os botões no topo dela. Os 245px não são
padding — são uma linha de grid vazia.

**O `h-[80dvh]` da `<section>` fica.** `hero-panel.tsx:32` é `h-full` e depende de a seção ter altura
definida; removê-lo colapsaria o painel.

- [ ] **Step 2: Trocar o grid por coluna flex e subir o eyebrow**

Substituir o bloco `hero.tsx:23-72` inteiro por:

```tsx
      <div className="mr-5 flex h-full w-[65ch] flex-col justify-center gap-6 pb-10 md:gap-8">
        <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {copy.hero.commandHint}
        </p>

        <div>
          <h1 className="whitespace-nowrap text-5xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground">
            {copy.hero.title}
          </h1>

          <p className="text-xl text-content-secondary">
            {(() => {
              let ci = -1;
              return copy.hero.subtitle.map((part, idx) => {
                if (!part.cycle) return <span key={idx}>{part.text}</span>;
                ci += 1;
                return (
                  <span
                    key={idx}
                    className={cn(
                      "transition-colors duration-700 ease-out-expo",
                      ci === activeWord ? "text-foreground" : "text-content-secondary",
                    )}
                  >
                    {part.text}
                  </span>
                );
              });
            })()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            size="lg"
            className="rounded-full bg-accent-primary text-primary-foreground hover:bg-accent-hover"
          >
            {copy.hero.ctaPrimary}
          </Button>

          <Button
            size="lg"
            variant="ghost"
            className="rounded-full border-t border-t-surface-line bg-surface-card hover:bg-surface-hover"
          >
            {copy.hero.ctaSecondary}
          </Button>
        </div>
      </div>
```

O que saiu: `grid grid-rows-3`, `justify-center` de grid, `row-start-2`, `row-start-3`,
`flex flex-col justify-end` do bloco de botões, e o `pl-5` do eyebrow. O que entrou:
`flex flex-col justify-center` com `gap`. O botão primário já vem com o crimson da Task 5.

- [ ] **Step 3: Medir o vão**

```bash
cd "$SCRATCH" && bun probe.ts > depois-task6.json && grep heroGap depois-task6.json
```

Esperado: `heroGap` **abaixo de 120**. O baseline real medido na Task 1 é **214** (`antes.json`) —
não ~245, que era estimativa em cima de screenshot.

O probe mede `h1 + p` até o primeiro botão, de propósito: esta task move o eyebrow pra cima do h1, e
um seletor de primeiro-parágrafo passaria a medir eyebrow→botão, uma distância maior. Se o
`probe.ts` do scratchpad ainda tiver `p + p, p` no lugar de `h1 + p`, corrija antes de medir.

- [ ] **Step 4: Confirmar que o painel não colapsou**

```bash
cd "$SCRATCH" && bun shot.ts
```

Abrir `s00.png`. Critérios: o painel da direita continua com a mesma altura de antes; o eyebrow
`SEM CARTÃO DE CRÉDITO` aparece acima do h1; não há faixa vazia entre o parágrafo e os botões.

- [ ] **Step 5: Gate e commit**

```bash
bun --filter @dailify/web format && bun run check 2>&1 | grep -iE "✖|Exited"
git add apps/web/src/components/landing/hero.tsx
git commit -m "fix(web): hero — remove a linha de grid vazia que abria 245px

A coluna era grid-rows-3 numa seção de 80dvh: três faixas iguais, a primeira
vazia e os botões presos no topo da terceira. Vira coluna flex centrada com
gap real, e o SEM CARTÃO DE CRÉDITO sobe para eyebrow acima do h1. A seção
mantém h-[80dvh] porque o HeroPanel é h-full.

Refs: Dailify-a3s"
```

---

### Task 7: Verificação final e fechamento

**Files:** nenhum (só verificação e a issue).

**Interfaces:**
- Consumes: tudo.
- Produces: evidência de que o defeito original sumiu.

- [ ] **Step 1: O teste do downscale**

Era o sintoma que abriu o diagnóstico: reduzido para 2000px de altura, o full-page perdia bento e
pricing.

```bash
cd "$SCRATCH" && bun shot.ts && bun -e '
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/usr/bin/chromium" });
const p = await (await b.newContext({ ignoreHTTPSErrors: true })).newPage();
await p.setViewportSize({ width: 592, height: 2000 });
await p.goto("https://localhost:1420/", { waitUntil: "networkidle" });
await p.screenshot({ path: "downscale.png", fullPage: true });
await b.close();'
```

Critério: em `downscale.png`, cada seção continua distinguível da vizinha — a laje clara de preços é
óbvia, e as duas lajes `raised` se separam do fundo.

- [ ] **Step 2: Comparar com o estado inicial**

```bash
cd "$SCRATCH" && cat antes.json | grep -E "heroGap|bg" | head -12
cat depois-task6.json | grep -E "heroGap|bg" | head -12
```

Esperado no depois: `heroGap` < 120; pelo menos três valores distintos de `bg` entre as seções
(`oklch(0.145 0 0)`, `oklch(0.175 0 0)`, `oklch(1 0 0)`), contra um valor só no antes.

- [ ] **Step 3: Gate completo**

```bash
bun run check 2>&1 | tail -20
```

Esperado: `0 errors` no lint (os ~43 warnings são pré-existentes), e `Exited with code 0` nos três
pacotes — web (29 testes), server (40), shared (22).

- [ ] **Step 4: Fechar a issue**

```bash
bd close Dailify-a3s --reason="Escada de valor, laje clara no pricing, crimson só em ação/estado ativo, hero sem a linha de grid vazia, ritmo em @utility. Timeline 01/02/03 e acento secundário ficaram fora por decisão registrada no spec."
```

- [ ] **Step 5: Abrir a issue de follow-up**

```bash
bd create --title="Landing: redesenhar a execução da timeline 01/02/03" --description="Três círculos numerados numa régua horizontal é a execução template. A numeração se justifica (o conteúdo é sequência de verdade), a forma não. Ficou fora do passe visual (Dailify-a3s) para não misturar redesenho criativo com ajuste de sistema. Ver docs/superpowers/specs/2026-08-09-landing-visual-pass-design.md, seção 'Fora de escopo'." --type=task --priority=3
```

- [ ] **Step 6: Reportar ao usuário**

Mostrar `s00.png` (hero), `s03.png` (laje raised), `s04.png` (laje clara) e `downscale.png`, com o
antes/depois do `heroGap` e da contagem de crimson. **Não dar push** — o usuário controla o push.

---

## Ordem e dependências

```
Task 1 (token + .light + probe)
  ├─→ Task 3 (raised)  ─┐
  └─→ Task 4 (light)   ─┤
Task 2 (section-y) ─────┤
Task 5 (crimson)  ──────┤   independente das outras, pode vir a qualquer momento
Task 6 (hero)     ──────┴─→ Task 7 (verificação)
```

Task 1 vem primeiro (cria o token e o probe). Tasks 3 e 4 dependem dela. Task 2 é independente mas
deve vir antes de 3, 4 e 6 para que essas já usem `section-y`. Task 5 é independente de todas.
Task 6 assume o botão crimson da Task 5 — se rodar fora de ordem, aplicar o botão na Task 6.
