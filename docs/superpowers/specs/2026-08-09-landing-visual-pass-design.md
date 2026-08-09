# Landing — passe visual: escada de valor, disciplina do crimson, hero e ritmo

**Data:** 2026-08-09
**Issue bd:** Dailify-a3s
**Branch:** `feat/landing-redesign`

## Problema

A landing roda num único valor de fundo ao longo de 4864px de altura. Todas as seções herdam
`--surface-page` do `<main>`; nenhuma declara superfície própria. O crimson aparece em cinco papéis
diferentes na mesma tela (eyebrow, chip numerado, badge, palavra no h1, botão), então o CTA não é
destaque. E o hero tem uma faixa vazia de ~245px entre o parágrafo e os botões.

Evidência objetiva: ao reduzir o screenshot full-page de 4864px para 2000px, o bento e o pricing
desaparecem. Os cards existem — o fill deles está perto demais do fundo para sobreviver ao downscale.
Uma página que some ao ser reduzida tem essencialmente um valor de luminância só.

Consequências, na ordem em que o usuário sente:

1. **Sem marco visual.** Não dá para saber onde se está na página pela visão periférica.
2. **O respiro não tem dono.** Os ~235px entre seções são consistentes, mas como o fundo não muda
   eles não pertencem a nenhuma seção — lê como vazio, não como ar. O bloco "Como funciona" tem
   ~250px de conteúdo entre 240px de nada dos dois lados.
3. **O crimson não tem regra.** Quando tudo é destaque, o botão que deve ser clicado não é.

## Fora de escopo

- **Redesenho da timeline `01/02/03`.** A execução (três círculos numa régua horizontal) é a resposta
  template; a numeração em si se justifica, porque o conteúdo é sequência de verdade. Fica para um
  passe próprio — misturado aqui, fica impossível avaliar o que causou o quê.
- **Acento secundário.** Considerado e descartado: o problema não é ter uma cor só, é essa cor não
  ter regra. Reavaliar depois da disciplina, se a página ainda parecer chapada.
- **Mobile e tema claro global.** Este passe foi diagnosticado em 1440px no tema dark. O passe
  responsivo é separado.
- **Contraste interno dos cards.** Lê bem em 100%; a baixa diferença card/fundo é intencional na
  estética. Só o nível de *seção* muda aqui.

## Decisão de fundação: `color-scheme` por subtree

Todos os tokens de superfície do projeto são `light-dark()` declarados em `:root`, e o `@theme inline`
mapeia `--color-*: var(--token)` — ou seja, a resolução acontece no ponto de uso, não na declaração.
Verificado empiricamente na página rodando:

```
root = .dark                → --surface-page   oklch(0.145 0 0)   (quase preto)
subtree color-scheme:light  → --surface-page   oklch(1 0 0)       (branco)
                            → --foreground     vira quase preto
                            → --surface-line   vira cinza claro
--surface-ink               → oklch(0.145 0 0) nos dois           (não flipa, como projetado)
```

Portanto **uma seção clara é uma classe num wrapper**: texto, bordas, cards e muted flipam sozinhos.
Isso é o que torna a laje clara barata o bastante para entrar neste passe.

## Design

### 1. Sistema

Um token novo e uma classe nova em `apps/web/src/global.css`.

A escada dark existente é `page 14.5% → card 16.8% → panel 19.5% → hover 22.5%` (L em oklch). Entra:

```css
--surface-raised: light-dark(oklch(98% 0 0), oklch(17.5% 0 0)); /* degrau de SEÇÃO */
```

mapeado em `@theme inline` como `--color-surface-raised`, seguindo os outros.

A regra que o token estabelece: **card fica ~2 pontos de L acima da sua seção.**

| seção   | L     | cards da seção   | L     | delta |
| ------- | ----- | ---------------- | ----- | ----- |
| page    | 14.5% | `surface-card`   | 16.8% | +2.3  |
| raised  | 17.5% | `surface-panel`  | 19.5% | +2.0  |

E a ponte que falta ao lado do `.dark` que já existe:

```css
.light {
  color-scheme: light;
}
```

### 2. Mapa de tom da página

Aplicado no `<section>` que cada componente já tem como raiz. Hairline (`--surface-line`) nas trocas
de tom — o hero já usa `border-b`, então é o padrão da casa, não uma invenção.

| Seção          | Arquivo             | Tom      |
| -------------- | ------------------- | -------- |
| Hero           | `hero.tsx`          | `page`   |
| Tabs           | `feature-tabs.tsx`  | `raised` |
| Bento          | `feature-bento.tsx` | `page`   |
| Como funciona  | `how-it-works.tsx`  | `raised` |
| Preços         | `pricing.tsx`       | `light`  |
| CTA + Footer   | `landingPage.tsx`   | `ink` (já é) |

O `<main>` continua `bg-surface-page`, então as seções `page` não precisam declarar nada.

**Consequência obrigatória:** os dois filhos que hoje usam `surface-card` dentro de seções que viram
`raised` ficariam *abaixo* da própria seção (16.8% sobre 17.5%), invertendo a elevação. Precisam subir
para `surface-panel`:

- `how-it-works.tsx:49` — chips `01/02/03`
- `feature-tabs.tsx:96` — `data-[state=inactive]:bg-surface-card` das pills

### 3. Disciplina do crimson

De 14 usos para 6. A regra: **crimson marca ação ou o estado ativo. Nada mais.**

**Fica:**

| Onde                             | Por quê                     |
| -------------------------------- | --------------------------- |
| `hero.tsx` — botão CTA           | ação                        |
| `cta.tsx` — botão do fechamento  | ação                        |
| `pricing.tsx` — botão Assinar Pro+AI | ação                    |
| `pricing.tsx` — `border-accent-primary` do card Pro+AI | é o alvo da ação |
| `feature-tabs.tsx:96` — tab ativa | estado ativo               |
| linha do agora nos mocks         | estado ativo                |

**Sai** (vira `text-muted-foreground` / neutro):

- `how-it-works.tsx` — eyebrow `// COMO FUNCIONA`, chips `01/02/03`, ponto da régua
- `pricing.tsx` — eyebrow `// PREÇOS`, badge `RECOMENDADO` e seu `bg-accent-subtle`
- `hero.tsx` — a palavra que cicla no h1

**Intocado:** `task-card.tsx` e `task-options.tsx` são mocks da UI do produto. O crimson ali representa
o app de verdade; demover seria representar o produto errado.

### 4. Hero

Causa medida, não estética: `hero.tsx:22` é `h-[80dvh]` e a coluna em `:23` é `grid grid-rows-3`. São
três faixas iguais de ~240px — faixa 1 vazia (o vazio acima do h1), faixa 2 com o texto, faixa 3 com
os botões no topo dela. Os 245px não são padding, são uma linha de grid vazia.

Troca por coluna flex com espaçamento explícito, e o `SEM CARTÃO DE CRÉDITO` sobe para eyebrow acima
do h1, preenchendo o vazio superior em vez de ficar solto sobre os botões.

O `h-[80dvh]` sai junto: a altura passa a vir do conteúdo mais o ritmo de seção. Isso remove o
acoplamento entre altura de viewport e posição do texto, que é o que produziu o buraco.

### 5. Ritmo vertical

`py-20 md:py-28` está hardcoded nos seis arquivos de seção. Vira um utility em `global.css`:

```css
@utility section-y {
  padding-block: --spacing(20);
  @variant md {
    padding-block: --spacing(28);
  }
}
```

O valor não muda neste passe. O ganho é que o respiro da página inteira passa a ser tunável numa
linha — e, com as lajes visíveis, o respiro passa a pertencer a uma seção, que era o problema real.

## Verificação

Não há lógica nova para testar em unit test; a verificação é visual e de regressão.

1. `bun run check` verde (format, lint, typecheck, os 3 suites).
2. `bun run build` verde e o CSS emitido contendo `--surface-raised` e `.light{color-scheme:light}`.
3. Screenshots antes/depois com o script já usado no diagnóstico
   (`playwright-core` + `/usr/bin/chromium`, 1440×900, dev server em `https://localhost:1420`).
   Critério: no full-page reduzido para 2000px, as seções continuam distinguíveis — que é exatamente
   o teste que a página falha hoje.
4. Contraste no pricing claro: o crimson **não** é `light-dark()`, então continua crimson sobre
   branco. Conferir o botão Assinar Pro+AI (texto sobre crimson) e a borda do card Pro+AI.
5. Confirmar que o `Grain` do fechamento (blend `screen`, só lê sobre escuro) não alcança o pricing
   claro — ele vive no container do fechamento, então não deve haver conflito, mas é o vizinho direto.

## Riscos

| Risco                                                     | Mitigação                                        |
| --------------------------------------------------------- | ------------------------------------------------ |
| `raised` a 17.5% ficar invisível como laje                 | screenshot; se sumir, sobe o L ou reforça o hairline |
| Algum filho de seção `raised` usar `surface-card` e eu não achar | grep por `surface-card` nos dois arquivos após a mudança |
| Crimson sobre branco no pricing ficar vibrante demais      | é o único ponto onde o acento encosta em fundo claro; avaliar no screenshot |
| Remover `h-[80dvh]` mudar a dobra mais do que o esperado   | screenshot do hero em 1440×900 antes/depois       |
