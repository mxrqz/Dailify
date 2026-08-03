# IDENTIDADE VISUAL — Dailify

> DNA visual da landing page (e da linguagem de marca) do **Dailify**. Este documento é a
> direção criativa para a IA que **implementa** o redesign. Descreve cenas visuais com detalhe
> suficiente para criar algo original — **não contém componentes prontos pra copiar**. Tokens
> (valores) são spec, não código de implementação.
>
> **Alvo:** bater de frente com Linear, Vercel e mastra.ai. Moderno, clean, escuro, uma cor só,
> técnico e **vivo**.
>
> Imagens de referência salvas (o implementador DEVE abri-las): `design/references/`.

---

## Stack Técnica

- **React 18 + Vite + TypeScript** · **Tailwind v4** (CSS-first `@theme`, tokens em
  `apps/web/src/global.css`) · **shadcn/ui** customizado via `className`.
- Todos os valores visuais = **tokens semânticos** já existentes em `global.css`, definidos UMA vez
  via `light-dark(light, dark)` em `oklch`. **Estender, nunca duplicar.** Sem hex/valor cru em
  componente (regra do projeto).
- **Sem `as` type assertions** (type guards). **Prettier** printWidth 100. `bun run check` é o gate.

## Setup Necessário

### Libs
| Lib | Pra quê | Estado |
|---|---|---|
| `framer-motion` (v12) | reveal no scroll, parallax, dissolve, indicador de aba, reduced-motion | **já instalado** |
| `@radix-ui/react-tabs` | base do switcher tipo aba-navegador | **já instalado** |
| `tailwindcss-animate` | utilitários de animação | **já instalado** |
| `@fontsource-variable/geist` + `@fontsource-variable/geist-mono` | Geist Sans + Mono self-hosted (Vite; o pacote `geist` é Next-only) | `bun add @fontsource-variable/geist @fontsource-variable/geist-mono` |
| _(opcional)_ shader de grão WebGL | só se quiser o grão-onda animado nível mastra no hero | **não instalar por padrão** — o default é CSS+SVG |

### Assets
Nenhum asset externo novo. Todas as cenas são **SVG inline / CSS**. Logo já existe
(`/dailify_logo_2.png`). **Remover** os PNGs de blob do hero atual (`blob_10_blur.png`,
`blobs-bottom.*.jpg`) — a atmosfera nova é grão + grid, não blob borrado.

---

## A Alma do App

**"O seu dia, projetado."** A precisão de uma ferramenta de dev — dark cinematográfico, grid
medido, labels monoespaçados, uma textura de grão que respira — aplicada à **calma de organizar o
dia**. O **crimson é o pulso do "agora"**: a única cor viva, sempre ligada a tempo/energia/ação.

O fio condutor de TODA a riqueza visual é **TEMPO**: o dia, a hora, a recorrência, o deadline,
o "agora". Cada conceito visual traduz uma faceta do tempo — nunca é ícone-numa-caixa.

O que o Dailify **não** é: SaaS genérico, dashboard corporativo, template shadcn recolorido,
arco-íris de cores, blob gradiente atrás de número.

---

## Referências e Princípios

**Imagens salvas** (`design/references/`):

- `ref-00-dailify-current-landing.png` — o **antes**. O que estamos substituindo: cards
  "ícone+texto", blob rosa borrado, conteúdo fake (plano "Team", 10 tasks, depoimentos inventados).
- `ref-01-mastra-browser-tab-sections.png` → **Princípio:** uma seção pode ser um painel grande
  com **abas tipo pasta/navegador** (label mono + ícone) no topo; a aba ativa "gruda" no painel.
  → **Aplicação:** o switcher de features do Dailify (Day / Calendário / Recorrência / Voz).
- `ref-02-mastra-footer-fade-into-page.png` → **Princípio:** o rodapé não corta seco — ele
  **emerge** do escuro acima (grão + máscara + cantos superiores arredondados). → **Aplicação:** a
  transição CTA→footer do Dailify, com linha de status mono honesta.
- `ref-03-animated-noise-wave-strip.png` → **Princípio:** uma **textura de grão que respira/ondula**
  como superfície viva. → **Aplicação:** textura ambiente da página inteira (opacity baixíssima).
- `ref-04-mastra-animated-hero.png` → **Princípio:** hero = headline apertada + 1 palavra na cor +
  CTAs + **painel de produto flutuante** que se monta na entrada. → **Aplicação:** o hero do
  Dailify com o day-view real animando.

**Concorrentes-alvo:**

- **Vercel** → near-black + Geist Sans com **tracking negativo agressivo** no display + Geist Mono
  em labels "de documentação" + bento. **Princípio:** tipografia "engenheirada" carrega a
  identidade; cor é acento, não fundo.
- **Linear** → dark cinematográfico, micro-interações de precisão, sombras multicamada sutis, UMA
  cor (violeta). **Princípio:** polimento e precisão > decoração.
- **mastra.ai** → dark + **uma cor (verde)** + labels mono + grão animado + painéis de produto
  flutuantes + seções tipo aba. **Princípio:** técnico e vivo ao mesmo tempo.

Extração central (não copiar): **base neutra escura + UMA cor forte + tipografia técnica + cada
componente conta uma história de TEMPO em SVG/CSS. O contraste entre momentos ricos e momentos
limpos É a identidade.**

---

## Decisões de Identidade

### ESTRUTURA

#### Ritmo da página
**O que:** seções full-width alternando **respiro** (hero, CTA) e **densidade** (bento de features,
pricing), separadas por muito espaço vertical e por **linhas/ticks de grid** finíssimas, não por
blocos de cor. Container central com `max-width` ~1100–1200px; gutters via o `clamp` já usado.
**Por que:** o ritmo respiro↔densidade é o que dá ar de Linear/Vercel; a linha fina no lugar do
bloco de cor é o que dá ar "técnico/blueprint".
**Nunca:** faixas de cor sólida separando seções (o CTA crimson atual é a exceção intencional).

#### Navegação (header)
**O que:** header fino, translúcido com `backdrop-blur`, hairline embaixo; logo à esquerda, links
mono no meio (opcional), toggle de tema + "Entrar"/"Começar" à direita. Encolhe/condensa no scroll.
**Por que:** discreto, deixa o conteúdo respirar; o mono nos links assina o tom técnico.
**Nunca:** header alto, colorido, com sombra pesada.

#### Apresentação de features = bento + aba-navegador
**O que:** duas superfícies distintas (ver RIQUEZA VISUAL): (a) um **bento** de cenas-conceito e
(b) um **painel com abas** mostrando superfícies reais do produto. Não repetir a mesma grade de 6
cards genéricos.
**Por que:** é o coração do redesign — sai de "lista de caixas" pra "narrativa de produto".

### LINGUAGEM

#### Tipografia
**O que:** **Geist Sans** no display e corpo; **Geist Mono** em eyebrows, números de seção,
labels de aba, timestamps, unidades de preço, hints de teclado, status. Display grande com
**tracking negativo** (-0.02em a -0.04em), peso 600–700, `leading` apertado. Mono sempre em
`text-xs`/`2xs`, `uppercase`, `tracking` levemente positivo, na cor `muted-foreground`.
**Por que:** o par sans+mono é o assinatura "engenheirado" das refs; o mono é a camada que
transforma texto comum em "documentação técnica".
**Como:** trocar `--font-sans` em `global.css` para Geist; adicionar `--font-mono` (Geist Mono).
**Nunca:** serifa; system-ui; mono em blocos de corpo longos.

#### Cor — a regra da cor única
**O que:** base **near-black neutra** + **crimson** (`--primary`, já a marca) como ÚNICA cor viva.
Crimson aparece em: logo, CTA primário, estado ativo/selecionado, a **linha do "agora"**,
prioridade-alta, focus ring, badge "recomendado", e o **tint do grão**. Todo o resto é escala de
cinzas neutros. Status (success/erro) só em feedback funcional.
**Por que:** identidade forte = base limpa + UMA cor. Crimson é distintivo (quase todo app de
produtividade é azul/roxo).
**Nunca:** o gradiente roxo→magenta→laranja na landing (ele vive **só** no task-preview, superfície
de produto). Nunca 2+ cores vivas. Nunca gradiente como "identidade".

#### Geometria & profundidade
**O que:** raios moderados — cards ~12px, **painéis grandes** (bento/aba/footer) ~20–24px
(`--radius-panel`), inputs/botões ~8–10px. Profundidade = **hairline borders** (1px neutro, low
alpha) + **um** shadow ambiente suave só nos painéis flutuantes + um **inner-highlight** no topo
(borda um tom mais clara) estilo Linear. Marcas de registro (ticks, cantos "+") **com parcimônia**.
**Por que:** flat + hairline + 1 sombra = precisão sem peso.
**Nunca:** sombras coloridas/glow em tudo; glassmorphism em todo elemento; raios enormes por toda
parte.

#### Iconografia
**O que:** `lucide-react` (já usado), stroke fino, **monocromático** (neutro; crimson só quando
ativo). Ícones pequenos, sempre pareados com um label mono. Ilustrações grandes NÃO são ícones —
são as cenas-conceito (abaixo).
**Nunca:** ícone dentro de caixinha colorida (o padrão atual `bg-red-500/10` — remover).

### RIQUEZA VISUAL ← obrigatório

#### Textura Ambiente — o "grão que respira"
**O que:** um **film-grain** sutil no nível da página, cobrindo tudo por baixo do conteúdo.
**Temática:** superfície viva = o dia "respirando"; conecta com o ar cinematográfico das refs.
**Tratamento:** `feTurbulence` (fractalNoise, `baseFrequency` alta ~0.7–0.9) rasterizado como
**data-URI tileável**, aplicado num overlay `fixed inset-0`, `pointer-events-none`, **opacity
4–7%**, `mix-blend` suave, monocromático (neutro, ou whisper de crimson ≤3%). O "respiro/onda" vem
de **animação CSS** — um `translate`/`background-position` lento (12–20s, ease-in-out, loop) ou uma
**máscara de gradiente que varre** a tela devagar — **nunca** re-rodando o filtro por frame.
`prefers-reduced-motion` → **estático**. _(Upgrade opcional: shader WebGL só no hero; não é o
default.)_ Segunda camada, ainda mais sutil: um **grid blueprint** (linhas 1px, opacity 3–4%) atrás
do hero e do footer, que some nas bordas.
**Nunca:** grão em opacity alta (vira sujeira); gradiente colorido como textura.

#### Conceitos Visuais por Componente

> Regra: **cada célula/painel importante conta uma história de TEMPO.** Tudo em SVG/CSS,
> crimson+neutro. Descreva a cena, não "adicione um SVG".

##### 1. Hero — o painel de produto que se monta
**Representa:** "seu dia, montado sem esforço" — a promessa em movimento.
**Metáfora visual:** o próprio day-view do Dailify surgindo do nada, ordenado.
**Cena detalhada:** à **esquerda**, eyebrow mono (ex: `// ORGANIZE SEU DIA`), headline Geist grande
e apertada com **uma palavra em crimson**, subheadline em `muted-foreground`, e 2 CTAs — primário
crimson sólido + secundário "ghost" (borda hairline, fundo transparente). Opcional: um terceiro
elemento mono estilo comando/atalho. À **direita**, um **painel do day-view real**, levemente
inclinado (`perspective`/`rotateY` ~4–8°), flutuando com o shadow ambiente. Na entrada (`whileInView`
/ load): a **coluna de horas** aparece primeiro, depois **blocos de tarefa deslizam pra suas horas**
em stagger, uma **linha horizontal crimson ("agora")** cruza e **pulsa** devagar, e a **célula de
hoje** acende em crimson. No scroll, o painel faz **parallax** leve (`useScroll`+`useTransform`).
**Viabilidade:** CÓDIGO PURO (reusar o layout real do day-view/`daily-tasks`).
**Reduced-motion:** tudo aparece estático, sem stagger, "agora" sem pulso.

##### 2. Switcher de superfícies — abas tipo navegador
**Representa:** "um app, várias formas de ver seu tempo."
**Metáfora visual:** um navegador/pasta com abas; cada aba é uma superfície do produto.
**Cena detalhada:** painel grande arredondado (`--radius-panel`), borda hairline + inner-highlight.
No **topo**, uma fileira de **abas-pasta**: label mono + ícone lucide pequeno (ex: `DAY`,
`CALENDÁRIO`, `RECORRÊNCIA`, `VOZ`). A aba ativa tem o **mesmo fundo do painel** e se conecta a ele
sem costura (sensação de "aba física"); um retângulo/realce **`layoutId`** desliza entre abas ao
trocar (framer-motion `LayoutGroup`). O **corpo** troca de conteúdo com crossfade + leve slide
(`AnimatePresence`), mostrando um mock fiel daquela superfície (mês, dia, recorrência, voz).
**Viabilidade:** CÓDIGO PURO — **Radix Tabs** (já instalado) + `layoutId` no indicador.
**Reduced-motion:** troca instantânea, sem slide.

##### 3. Bento de conceitos — cenas de TEMPO
**Representa:** as capacidades do produto, cada uma como uma cena, não um card de texto.
**Metáfora visual + cena (SVG/CSS, crimson+neutro):**
- **Calendário / visão do mês** → mini-grid do mês; célula "hoje" acesa em crimson; **ticks** de
  tarefa preenchendo alguns dias; um sweep suave realça "hoje". _(sua vida num relance; hoje é
  agora)_
- **Tarefas por horário** → uma **coluna-timeline** vertical com marcas de hora; blocos de tarefa
  encaixados nas horas; **linha "agora" crimson** cruzando. _(o dia como uma coluna cronometrada)_
- **Prioridade** → uma **pilha de barras** que se reordena por peso; a do topo em crimson. _(o que
  importa sobe)_
- **Recorrência** → um **caminho circular/loop** com um nó-tarefa orbitando e **ghosts** dos
  repeats atrás (Daily/Weekly/Monthly como rótulos mono). _(volta sozinho)_
- **Voz / IA (Pro+AI)** → uma **waveform crimson** que se resolve, da esquerda pra direita, em **2
  linhas de tarefa estruturadas**. Célula-**herói** do bento (maior), porque é o diferencial. _(você
  fala, vira tarefa)_
- **Lembretes** → um **sino/relógio** com um **anel crimson pulsando** posicionado no offset do
  alerta sobre uma mini-timeline. _(te cutuca na hora certa)_

**Layout:** bento assimétrico — a célula de Voz ocupa 2× (largura ou altura); as demais preenchem
ao redor. Todas com borda hairline; a de Voz com um tint crimson ≤4% no fundo.
**Viabilidade:** CÓDIGO PURO. **Alternativa simplificada:** se alguma cena ficar pesada, versão
wireframe geométrica (retângulos/linhas/arcos) mantendo a história.
**Reduced-motion:** cenas estáticas no estado final (sem sweep/órbita/pulso).

##### 4. "Como funciona" — a linha do tempo de 3 passos
**Representa:** começar é rápido — 3 passos.
**Cena detalhada:** `[01] [02] [03]` em mono, ligados por uma **linha-timeline** horizontal (o mesmo
motivo da coluna do dia, deitado). Um ponto crimson percorre a linha no scroll
(`useScroll`+`useTransform`).
**Viabilidade:** CÓDIGO PURO.

##### 5. Pricing — 3 planos, a verdade
**Representa:** transparência.
**Cena detalhada:** 3 cards limpos (Free / Pro / Pro+AI). **Crimson só no recomendado** (borda +
badge mono "RECOMENDADO"). Preço grande em Geist; **unidade e limites em mono**. Sem cena decorativa
pesada — o contraste com o bento rico é intencional (aqui é clean).
**Conteúdo (obrigatório, ver seção Conteúdo):** números vêm de `@dailify/shared` `PLAN_PERMISSIONS`
e preços do Stripe — **nunca hard-coded**.

##### 6. Footer que dissolve
**Representa:** fim calmo, sem corte.
**Cena detalhada:** a seção CTA (crimson) é o último bloco cheio; **abaixo dela**, o footer
**emerge do escuro**: grão + **máscara de gradiente** no topo do footer + **cantos superiores
arredondados** grandes (`--radius-panel`+). Colunas de links **honestas** (só o que existe). Uma
linha **status mono** (ex: `DAILIFY // 2026 · feito no Brasil` + um ponto verde `success` só se
houver um status real a comunicar). Redes sociais só as reais.
**Viabilidade:** CÓDIGO PURO (máscara CSS + grão compartilhado).

---

## Tokens de Design

> Estender os tokens de `apps/web/src/global.css`. Cada cor UMA vez via `light-dark()`; valores dark
> abaixo são o alvo da landing dark-first. Reaproveitar os existentes quando já servem.

### Cores — Fundos (dark / light)
| Token | Dark (alvo) | Light | Uso |
|---|---|---|---|
| `surface-page` | `oklch(13% 0.004 49)` | `oklch(100% 0 0)` | fundo da página (o mais escuro) |
| `surface-card` | `oklch(19% 0.005 56)` | `oklch(98% 0 0)` | cards / células do bento |
| `surface-panel` | `oklch(21.6% 0.006 56)` (=`--card`) | `oklch(100% 0 0)` | painéis grandes (aba, footer) |
| `surface-hover` | `oklch(24% 0.005 56)` | `oklch(96.8% 0.001 286)` | hover |

### Cores — Texto
| Token | Valor | Uso |
|---|---|---|
| `text-primary` | `--foreground` | títulos, headline |
| `text-secondary` | `oklch(80% 0.01 286)` | subheads |
| `text-muted` | `--muted-foreground` | labels mono, hints |

### Cor — Accent (UMA só)
| Token | Valor | Uso |
|---|---|---|
| `accent-primary` | `--primary` = `oklch(58.6% 0.222 17.6)` | a cor da marca — CTA, ativo, "agora", focus |
| `accent-hover` | `oklch(54% 0.222 17.6)` | hover do accent |
| `accent-subtle` | crimson @ 8–12% alpha | tints (badge, célula de Voz, hover) |
| `accent-glow` | crimson @ 18–24% alpha, blur | glow/pulso da linha "agora" (usar com moderação) |

### Cores — Status (só feedback funcional)
| Token | Valor | Uso |
|---|---|---|
| `status-success` | `--success` | ponto de status / confirmação |
| `status-error` | `--destructive` | erro |

### Bordas
| Token | Valor | Uso |
|---|---|---|
| `border-default` | `--border` | contornos de card/painel |
| `border-subtle` | border @ ~50% alpha | grid blueprint, divisórias finas |
| `border-highlight` | `oklch(30% 0.005 286)` | inner-highlight no topo dos painéis |

### Geometria
| Token | Valor | Uso |
|---|---|---|
| `radius-input` | 8px | inputs / botões pequenos |
| `radius-button` | 10px | botões |
| `radius-card` | 12px | cards / células do bento |
| `radius-panel` | 22px | painel de abas, footer, painel do hero |

### Sombras
| Token | Valor (guia) | Uso |
|---|---|---|
| `shadow-panel` | ambiente suave, grande e difusa, baixa opacidade | painéis flutuantes (hero, aba) |
| `shadow-card` | mínima ou nenhuma (usar borda) | cards do bento |

### Tipografia
| Token | Valor | Uso |
|---|---|---|
| `--font-sans` | Geist Sans | display + corpo |
| `--font-mono` | Geist Mono | eyebrows, labels de aba, números, unidades, status |
| display tracking | -0.02em a -0.04em | headlines grandes |
| mono | `uppercase`, `text-xs`/`2xs`, tracking +0.04em | labels técnicos |

---

## Componentes Shadcn — Overrides
| Componente | Override (via tokens) |
|---|---|
| `<Button>` primário | `bg-accent-primary` + `hover:bg-accent-hover`, `rounded-button`, sem sombra pesada |
| `<Button>` ghost | fundo transparente, `border-default`, `hover:bg-surface-hover` |
| `<Card>` / célula bento | `bg-surface-card`, `border-default`, `rounded-card`, `shadow-card`, inner-highlight |
| `<Badge>` "recomendado" | `bg-accent-subtle`, `text-accent-primary`, mono uppercase |
| `<Tabs>` (Radix) | abas mono; indicador com `layoutId`; painel `bg-surface-panel` `rounded-panel` |
| `<Input>` (newsletter) | `bg-surface-page`, `border-default`, `rounded-input` |

---

## Conteúdo — a verdade do produto (obrigatório)

A landing atual tem conteúdo **falso/desatualizado**. Corrigir:

- **Planos:** `Free` · `Pro` · `Pro+AI` (NÃO existe "Team"). Números de `@dailify/shared`
  `PLAN_PERMISSIONS`, preços do Stripe — **nunca hard-code**:
  - **Free:** 30 tarefas/mês, sem recorrência, sem voz.
  - **Pro:** tarefas ilimitadas + recorrência.
  - **Pro+AI:** tudo do Pro + **criação de tarefa por voz (IA)**.
- **Remover:** "Up to 10 daily tasks", plano "Team $12", **a seção de depoimentos inteira** (eram
  pessoas inventadas — volta quando houver reais), e links de footer fantasma (Blog, API
  Documentation, Careers, Integrations, Changelog, Help Center, Tutorials, About Us).
- **Footer honesto:** só links reais (Features, Pricing, `/privacidade`, `/termos`, e redes/GitHub
  se existirem). Copyright **© 2026**.
- **Idioma:** copy em **pt-BR** (alinha com a padronização do app — bd `Dailify-17s`), com as
  strings **estruturadas num dicionário** pra dropar um locale `en` depois (bd `Dailify-1xy`).
  Nunca hard-codar strings soltas no JSX.

---

## Motion (framer-motion v12 — já instalado)

- **Reveal no scroll:** `whileInView` + `viewport={{ once: true }}`, com **stagger** nos filhos
  (bento, listas de tarefa do hero).
- **Scroll-linked:** `useScroll` + `useTransform` para parallax do painel do hero, o ponto que
  percorre a timeline "como funciona", o drift do grão e o dissolve do footer.
- **Indicador de aba:** `layoutId` + `LayoutGroup` (shared layout) para o realce deslizar entre
  abas; conteúdo troca com `AnimatePresence`.
- **Acessibilidade:** `useReducedMotion()` em TODA animação — troca `translate` por `opacity`,
  mata loops (pulso do "agora", órbita da recorrência, sweep), deixa o grão estático. Import de
  `framer-motion` (pacote instalado; `motion/react` também funciona na v12). Manter consistência
  com os imports já usados no projeto.

---

## Regra de Ouro
1. Siga TODAS as decisões (estrutura + linguagem + riqueza visual).
2. shadcn/ui como base, customizado via `className`; **só tokens semânticos**, nunca valor cru.
3. **UMA cor viva** (crimson) + neutros. Nenhuma outra cor vibrante. Gradiente de marca fica fora
   da landing.
4. Todo componente importante tem **conceito visual de TEMPO** — cena SVG/CSS original, não
   caixa-com-ícone, não blob/dot-grid genérico.
5. Grão + grid são **textura ambiente** (fundo, opacity baixíssima), nunca protagonistas.
6. `prefers-reduced-motion` sempre respeitado.
7. Conteúdo **verdadeiro** (planos reais, sem fake), copy pt-BR estruturada pra i18n.
8. A alma em 1 linha: **o seu dia, projetado — crimson é o pulso do agora.**

## Teste Final
Coloque a landing nova ao lado de um dashboard shadcn padrão. A diferença deve ser óbvia em 3
níveis:
- **ESTRUTURA:** hero com painel flutuante, features como bento + abas-navegador, footer que
  dissolve — não uma pilha de seções centralizadas iguais.
- **LINGUAGEM:** Geist + mono técnico, tracking negativo no display, **uma cor forte** (não
  arco-íris), hairline no lugar de blocos de cor.
- **RIQUEZA:** cada momento importante tem uma **cena de TEMPO** própria contando o que ele faz.

Se os cards forem caixas com ícone, ou tiverem blob/dot-grid no lugar de conceito, está
**incompleto**. Se aparecer uma 2ª cor viva, está **errado**.
