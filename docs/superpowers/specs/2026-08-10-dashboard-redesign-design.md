# Dashboard — redesign no art style da landing

**Data:** 2026-08-10
**Issue bd:** Dailify-r9i (epic)
**Branch:** `worktree-dashboard-redesign`

## Problema

A landing passou por um passe visual completo (`Dailify-a3s`, spec `2026-08-09-landing-visual-pass-design.md`)
e saiu de lá com um vocabulário próprio: escada de superfícies em oklch, mono uppercase para dado de
máquina, crimson com regra, radius grande, `shadow-panel`. O `/dashboard` não recebeu nada disso.

O contraste, arquivo por arquivo:

| | Landing | `/dashboard` |
| --- | --- | --- |
| superfície | `surface-page` / `card` / `panel` / `line` | `bg-background`, `border` cru |
| raio | `rounded-panel` (1.375rem), `rounded-2xl` | `rounded-md` |
| cor de estado | tokens (`success`, `accent-primary`) | `border-green-500`, `bg-red-500` |
| dado de máquina | `font-mono text-2xs uppercase tracking-[0.04em]` | `text-base font-medium` |
| idioma | pt-BR (`landing/copy.ts`) | inglês (`"Today's Tasks"`, `"New Task"`) |
| profundidade | `shadow-panel`, hairline por costura | `shadow` do Tailwind |

O achado que define este passe: **`components/landing/mocks/` já é um protótipo do dashboard.**
`DayAppWindow`, `DayColumn`, `CalendarAppWindow` e `TaskDetailSheet` desenham as telas do app no
vocabulário novo, e `landing/task-card.tsx` não é decoração — é um `TaskCard` real, com crossfade
skeleton→conteúdo, cluster de dots de overflow de tag e `TagBadge` reutilizável.

Ou seja: o alvo do redesign já está desenhado, revisado e em produção — só que na página errada.
Quem clica em "Começar — é grátis" (`hero.tsx:62`) chega numa tela que não se parece com nenhuma das
quatro que acabou de ver nas abas.

Consequências, na ordem em que o usuário sente:

1. **Quebra de promessa.** A landing vende uma coluna de dia com gutter de horário e linha do "agora";
   o app entrega um mini-calendário, três botões quadrados soltos e uma lista agrupada por `HH:MM`.
2. **O app parece um protótipo.** `border-green-500` ao lado de tokens oklch, `bg-red-500` num botão
   de excluir, `bg-surface-header/70` — a única superfície tokenizada do dashboard, e com opacidade,
   contra a regra do bd `k00`.
3. **Idioma misturado.** Landing em pt-BR, app em inglês, toasts em ambos (`new-task.tsx:59` já é
   pt-BR, `:117` é inglês, no mesmo arquivo).

## Decisão de fundação: mesmo vocabulário, gramática diferente

A tradução não é "aplicar as seções da landing no app". Uma landing é percorrida **uma vez**, de cima
a baixo, e ali a escada de superfícies serve de **marco de progresso** — foi exatamente o problema que
`Dailify-a3s` resolveu ("não dá pra saber onde se está na página pela visão periférica"). O dashboard
fica aberto por horas, não tem seções e não tem progressão vertical. A mesma escada serve para outra
coisa: **profundidade de contêiner** (chão → janela → cartão → hover).

Daí o mapa do que vem e do que fica:

| Token / recurso | No dashboard |
| --- | --- |
| `surface-page` | o shell — declarado no `<main>`, ver abaixo |
| `surface-card` | as **janelas**: dia, mês, cartões do aside |
| `surface-raised` | **não usar** — é o degrau de *seção*, e não há seções |
| `surface-panel` | **não usar como fill de card** — ver §2 |
| `surface-hover` | hover de tarefa e de célula do mês (mesmo papel) |
| `surface-slab` / `surface-slab-card` | **não usar** — é a laje de destaque, uma por *página* |
| `surface-ink` / `-foreground` / `-muted` / `-line` | **não usar** — é o fechamento da landing |
| `surface-line` | hairlines, em todo lugar |
| `Grain` (WebGL `MeshGradient`) | **não usar** — ver abaixo |
| `Noise` (SVG `feTurbulence`) + `RadialGlow` | uma vez, no chrome da janela do dia |

**Por que o `Grain` não entra:** ele monta um canvas WebGL que anima continuamente
(`grain.tsx:108`, `speed: 1.1`). Na landing isso é aceitável — a página é visitada por um minuto e o
`IntersectionObserver` só monta o que entrou na viewport. Um app de agenda fica aberto o dia inteiro;
seria GPU e bateria permanentes pelo resto da sessão. O `Noise` (SVG estático, `panel-fx.tsx:40`) dá
a mesma textura por custo zero e é o que o dashboard usa.

## Fora de escopo

- **`/premium`.** Tem as cores mais cruas do repo (`purple-500`, `green-500` em `premium.tsx:174`,
  `:215`+) e merece o mesmo tratamento, mas é a página de conversão e o passe dela mexe em copy de
  plano e preço — trabalho de outra natureza. Vira follow-up.
- **`/task/:id`** (`task-preview.tsx`). É renderizado como imagem via `html-to-image`; as cores dele
  (`bg-zinc-100 dark:bg-zinc-900`) existem para sobreviver à serialização, não por descuido. Mexer
  aí sem testar a imagem gerada é regressão garantida.
- **Reestruturar o `/profile`.** São 1074 linhas em `profileTabs.tsx`; ele recebe o vocabulário novo
  (superfícies, mono, radius, tokens de cor) mas **não** muda de layout. Reestruturar é outro projeto.
- **Camada de i18n.** O dashboard ganha um `copy.ts` espelhando `landing/copy.ts`; a camada de i18n
  de verdade continua sendo o bd `17s`.
- **Mobile.** Como no passe da landing, o diagnóstico é em 1440px. As telas nascem com os breakpoints
  `md:` que já existem, mas o passe responsivo dedicado é separado.

## Design

### 1. Escada de superfícies do app

**O chão do app hoje não é o chão da landing.** `global.css:323` pinta o `body` de `bg-canvas`, e
`--canvas` no dark é `oklch(21% 0.006 285.9)` — 21% de L e **tingido de azul**, enquanto
`--surface-page` é `oklch(14.5% 0 0)`, preto neutro. São 6,5 pontos de L e uma tinta de diferença: o
dashboard herda o canvas azulado, e a landing só escapa porque `landingPage.tsx:13` declara
`bg-surface-page` no `<main>`. O dashboard faz o mesmo — sem tocar no `body`, que continua servindo
`/login`, `/premium` e as demais páginas que ainda não passaram pelo passe.

```
surface-page   14.5%   shell (declarado no <main> do dashboard)
surface-card   16.8%   janela (dia · mês · cartões do aside)      +2.3 L
  └ cartão de tarefa: SEM fill — border-surface-line
        hover        → surface-hover 22.5%
        selecionada  → border-accent-primary
```

Dois fills e um contorno. Vem direto do mock: `task-card.tsx:108` é
`rounded-lg border bg-transparent`, e `:109` troca só a *cor da borda* no estado selecionado. Empilhar
um terceiro cinza dentro da janela (`surface-panel` a 19.5% sobre `surface-card` a 16.8%) daria +2.7 L
— dentro da regra, mas a janela já é o contêiner; o cartão precisa de separação, não de elevação.

A regra herdada continua valendo: **uma hairline por costura**, sempre do elemento de baixo/interno.

### 2. Vocabulário

**Tipografia.** A divisão é semântica, não decorativa: **mono para o que a máquina sabe, sans para o
que o humano escreveu.**

| Papel | Classe |
| --- | --- |
| horário no gutter, duração, data do chrome | `font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground` |
| label de bloco ("PRÓXIMA TAREFA") | `font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground` |
| título de tarefa | `text-sm font-medium text-foreground` |
| título de janela | `text-sm font-medium` no chrome; `text-lg font-semibold tracking-[-0.01em]` no detalhe |
| descrição, texto secundário | `text-sm text-content-secondary` (não `text-muted-foreground`) |

**Crimson.** A regra da landing atravessa inteira: **ação ou estado ativo, nada mais.** No dashboard
isso fecha em **cinco papéis**, e a lista é exaustiva — qualquer crimson que não mapeie num deles é
bug de review. Papel, não ocorrência: "hoje" é um papel só, ainda que apareça no dot do chrome e na
pill do mini-calendário ao mesmo tempo.

| Papel | Onde aparece |
| --- | --- |
| ação primária | botão "Nova tarefa"; o botão de confirmar de cada modal/sheet (um por vez) |
| view ativa | pill ativa do toggle Hoje/Mês |
| hoje | dot do chrome da janela do dia + pill do dia no mini-calendário e no mês |
| agora | linha do "agora" (+ `accent-glow`) |
| tarefa aberta | borda do cartão cuja sheet está aberta |

Fora dessa lista: `text-muted-foreground`, `surface-line`, ou os tokens semânticos (`success`,
`destructive`, `--priority-*`).

**Forma.** `rounded-2xl` janelas · `rounded-lg` cartões de tarefa · `rounded-full` pills, chips e
botões de ação · `shadow-panel` nas janelas.

**Movimento.** `ease-out-expo` (`[0.16, 1, 0.3, 1]`), stagger 0.06 na entrada da lista, crossfade
0.25s na troca dia↔mês, `initial={false}` onde o pai já anima. Todo bloco animado lê
`useReducedMotion()` — o padrão é o da landing, não uma variação.

### 3. Tokens novos em `global.css`

```css
/* escala de prioridade 0–4 — fecha bd emm */
--priority-0: light-dark(oklch(55.2% 0.014 285.9), oklch(71.2% 0.013 286.1));
--priority-1: light-dark(oklch(52%   0.15  149.6), oklch(69.6% 0.17  149.6));
--priority-2: light-dark(oklch(66%   0.14  85),    oklch(80%   0.16  85));
--priority-3: light-dark(oklch(63%   0.18  50),    oklch(75%   0.17  55));
--priority-4: light-dark(oklch(58.6% 0.222 17.6),  oklch(70%   0.20  20));
```

mapeados em `@theme inline` como `--color-priority-0..4`, e `consts/conts.ts` passa a apontar para
eles (`priorityTextColor = ["text-priority-0", …]`). Os valores acima são o *ponto de partida*: a
verificação exige conferir contraste sobre `surface-card` nos dois temas e ajustar o L antes de fechar.

`--priority-4` cai propositalmente no mesmo hue do crimson. Prioridade máxima é a única exceção
legítima à regra dos cinco papéis, porque ali a cor **é** o dado — mas ela aparece só como ícone
`Flag` dentro de um pill neutro, nunca como fill de superfície, então não compete com a ação.

### 4. Componentes

**`TaskCard` promovido** — `components/landing/task-card.tsx` → `components/task-card.tsx`.
Ele já traz o crossfade skeleton→conteúdo (`task-card.tsx:140`) que o dashboard nunca teve. Ganha
props **opcionais**, então a landing continua passando os mesmos quatro campos e não muda:

```ts
TaskCardData & {
  loading?: boolean
  selected?: boolean
  completed?: boolean          // título em line-through + Check em text-success
  priority?: number            // ícone Flag em text-priority-N
  onClick?: () => void
  actions?: ReactNode          // o menu (⋮) do app
}
```

São seis imports a atualizar, e nem todos são de `TaskCard` — três importam só o `TagBadge`:

```
mocks/day-column.tsx             TaskCard, TaskCardData
mocks/voice-result-card.tsx      TaskCard
scenes/scene-tarefas.tsx         TaskCard, TaskCardData
mocks/task-detail-sheet.tsx      TagBadge
mocks/recurrence-app-window.tsx  TagBadge
scenes/scene-recorrencia.tsx     TagBadge
```

Sem arquivo-ponte de re-export — o repo é pequeno o bastante para mover de vez.

**`taskToCardData(task, day)`** — adaptador **puro** em `functions/functions.ts`, com teste. Converte
`TaskProps` (epoch-ms, `priority: number`, `completed: number[]`) no `TaskCardData` de strings que o
card consome, incluindo `completed` via `getCompletionDate(task, day)`. Toda a formatação de tarefa
passa a ter um lugar só e testável, em vez de estar espalhada em `daily-tasks.tsx` e
`calendar-view.tsx` (hoje ambos reimplementam o mesmo `reduce` de agrupamento por horário).

**`groupTasksByTime(tasks)`** — o mesmo `reduce`+`sort` está duplicado literalmente em
`daily-tasks.tsx:55-72` e `calendar-view.tsx:138-155`. Vira uma função pura testada; as duas telas
consomem.

**Header dividido** — `header.tsx:18` faz `const path = window.location.pathname` e ramifica em três
lugares. Isso não reage a navegação client-side do react-router: hoje funciona por acidente (o
componente remonta a cada troca de rota porque as rotas são elementos irmãos), e passa a não funcionar
no instante em que alguém envolver as rotas num layout compartilhado.

Vira `SiteHeader` (landing, público) + `AppHeader` (dashboard/profile, autenticado), compartilhando um
`<Brand/>` e o `ModeToggle`. Dois componentes pequenos custam menos que um com três branches, e a
bifurcação some junto com o `pathname`. `AppHeader` é `sticky top-0 bg-surface-page` **sólido**
(hoje é `bg-surface-header/70 backdrop-blur`, contra o bd `k00`) com `border-b border-surface-line`, e
carrega o toggle Hoje/Mês.

**`copy.ts` do dashboard** — `components/dashboard/copy.ts`, plano, espelhando a estrutura de
`landing/copy.ts`, com o mesmo aviso no topo sobre não hard-codar limite de plano.

### 5. As telas

#### Shell (`pages/home.tsx`)

`px-[clamp(1rem,5vw,24rem)]` (repetido em duas linhas) vira `px-gutter`, o mesmo utility da landing —
o teto de 1380px (`--layout-content`) passa a valer para o app também. O toggle dia↔mês sai do botão
de ícone solto (`select-day.tsx:35`, um `Calendar1Icon` sem rótulo) e sobe para o `AppHeader` como
segmented control de duas pills mono, na mesma linguagem do toggle Mensal/Anual do pricing
(`pricing.tsx:77-96`). `select-day.tsx` deixa de existir; o que ele fazia se divide entre `AppHeader`
(toggle) e o aside (calendário, próxima tarefa, ações).

#### Dia — `components/dashboard/day-view.tsx`

Janela `rounded-2xl border-surface-line bg-surface-card shadow-panel`, com o chrome do mock
(`day-app-window.tsx:23`): dot + "Hoje" à esquerda, data mono à direita. O dot é
`bg-accent-primary` com glow **apenas quando o dia selecionado é hoje**; nos outros dias é
`bg-muted-foreground` sem glow e o rótulo vira o dia da semana.

Corpo: gutter de horário mono (`w-12 text-right`) + `TaskCard`. Três regras que o mock não precisou
resolver e a tela real precisa:

1. **Horário repetido aparece uma vez.** `groupTasksByTime` já agrupa; dentro do grupo, só o primeiro
   cartão recebe o rótulo e os demais ficam com o gutter vazio. É isso que produz a leitura de coluna
   do tempo — repetir "08:30" três vezes viraria ruído.
2. **Linha do "agora"** (`day-column.tsx:18`) só existe quando `isToday(selectedDay)`, inserida entre
   os grupos pela comparação do `HH:MM` do grupo com a hora atual. Um hook mínimo `useNow(60_000)`
   mantém a posição correta — um app de agenda aberto o dia todo com a linha congelada é um bug
   visível, e o tick custa quatro linhas.
3. **Antes do primeiro grupo e depois do último** a linha ainda aparece (topo ou base da lista), senão
   ela some justamente nos dois momentos do dia em que ela mais informa.

**Empty state** (não existe hoje: o dia sem tarefas mostra o título e nada): label mono
`SEM TAREFAS PARA ESTE DIA` + uma frase em `text-content-secondary` + o botão de criar.

**Loading**: `isLoading` do contexto renderiza três `TaskCard` com `loading`, e o crossfade que já
existe no componente resolve a transição. Ganho de qualidade por reuso puro.

#### Aside — `components/dashboard/day-aside.tsx`

Três blocos empilhados, cada um um cartão `surface-card`:

1. **Mini-calendário** — `ui/calendar2.tsx` restilizado. Hoje ele tem `bg-muted opacity-30` nos dias
   fora do mês e `bg-primary` no dia de hoje; passa a `text-muted-foreground` sem fill e pill crimson.
   **Atenção:** `calendar2.tsx:25` navega mês com `setSelectedDay(subMonths(...))`, ou seja trocar de
   mês troca o dia selecionado — e `protected-route` refetcha quando o mês muda. Comportamento
   preservado como está; mudá-lo é outro assunto.
2. **Próxima tarefa** — label mono + `getNextTask(currentMonthTasks)`. Note que a "próxima" é do mês
   inteiro, não do dia: é o que dá utilidade ao bloco quando o dia selecionado está vazio.
3. **Ações** — `+ Nova tarefa` crimson `rounded-full` em largura total, microfone ao lado
   (`NewTaskVoice` já se esconde sozinho sem entitlement, `new-task-voice.tsx:41` — manter).

#### Mês — `components/dashboard/month-view.tsx`

Restilização de `calendar-view.tsx`, **sem** reduzi-lo ao mock: o `CalendarAppWindow` mostra só dots
porque ocupa metade de uma cena de landing; um app tem a tela inteira e mostra títulos. O que muda:

- janela + chrome (mês, `‹ ›`, "hoje") no lugar dos três botões `variant="outline"` soltos
- cabeçalho de semana em mono `2xs` uppercase
- célula: sem fill, `border-surface-line`, `hover:bg-surface-hover`
- fora do mês: `text-muted-foreground` (hoje é `bg-muted`, que pinta um bloco cinza)
- hoje: número em pill `bg-accent-primary size-7 rounded-full` (assinatura do mock,
  `calendar-app-window.tsx:80-89`) no lugar de `border-2 border-foreground`
- dia selecionado: `border-accent-primary`
- tarefas na célula: dot de tag + título truncado em `text-2xs`; overflow vira `+N` mono
- **semana começa no domingo**, como todo o resto do app (`weekDays` em `conts.ts:65` indexa
  `0=Sunday`, e a recorrência semanal depende dessa ordem). O comentário de
  `calendar-app-window.tsx:5` diz "segunda-a-domingo, casando com o app" e está errado — o mock da
  landing é que é corrigido, reordenando `WEEKDAY_LABELS` e o offset de `MONTH_DAYS`.

A `Sheet` do dia (`calendar-view.tsx:189`) recebe o vocabulário do `TaskDetailSheet` e o `copy` pt-BR
(hoje: "Tasks for the Day" / "View and manage your tasks for the selected day.").

#### Detalhe e edição

Hoje clicar numa tarefa abre direto o formulário (`EditTaskTrigger` → `EditTaskContent`). Passa a
abrir a **Sheet de leitura** que a landing já vende (`mocks/task-detail-sheet.tsx`): título, linha
`Clock` mono com data·hora·duração, descrição, metas de prioridade/repetição/lembrete em pills
`border-surface-line`, tags, e `Concluir` crimson no rodapé — mais Editar e Excluir. "Editar" troca o
conteúdo da mesma Sheet para o formulário.

O formulário em si (`edit-task.tsx`, `new-task.tsx`) muda de pele, não de estrutura: `Label` em mono
uppercase `2xs`, campos com `border-surface-line` e `focus-within:border-accent-primary`, rodapé com
Cancelar (ghost) + Salvar (crimson). O `bg-red-500` do botão excluir (`daily-tasks.tsx:152`) vira
`variant="destructive"`; o `border-green-500` do badge Completed (`:117`) some — a conclusão passa a
ser título riscado + `Check` em `text-success`, que é menos ruído por mais informação.

Este é o passo que adiciona uma etapa onde hoje há uma só, e é a fase cortável se o escopo apertar.

### 6. Fases

| # | Fase | Entrega |
| --- | --- | --- |
| 0 | Fundação | tokens `--priority-*`, `copy.ts`, `TaskCard` promovido, `taskToCardData` + `groupTasksByTime` (com testes) |
| 1 | Shell | `SiteHeader` / `AppHeader` / `<Brand/>`, `px-gutter`, toggle Hoje/Mês, `select-day.tsx` desmontado |
| 2 | Dia | `day-view.tsx` + `day-aside.tsx`, gutter, linha do agora, empty, skeleton |
| 3 | Mês | `month-view.tsx` + Sheet do dia; correção domingo-primeiro no mock da landing |
| 4 | Detalhe | Sheet de leitura + edição repaginada |
| 5 | Criação | `NewTask` / `NewTaskVoice` |
| 6 | Profile | vocabulário aplicado, layout intocado |

Fases 0–2 são o núcleo: no fim da 2 o `/dashboard` já cumpre a promessa da landing. 3–6 completam.

## Verificação

Lógica nova existe em três pontos e vai por TDD — `taskToCardData`, `groupTasksByTime` e o
posicionamento da linha do "agora" (dado um horário e uma lista de grupos, em qual índice ela entra;
incluindo os casos antes-de-todos e depois-de-todos). O resto é visual e de regressão.

1. `bun run check` verde (format, lint, typecheck, os 3 suites). Baseline medido nesta worktree:
   web 29 testes · server 40 · shared 22, com 0 erros e **43 warnings** pré-existentes de lint
   (`consistent-type-assertions` e `exhaustive-deps`, bd `aqa` e `0g7`). O número de warnings
   **não pode subir**.
2. `bun run build` verde, e o CSS emitido contendo `--priority-0`…`--priority-4`.
3. Screenshots 1440×900 em `/dashboard` nos dois temas, dia e mês. Chromium headless direto
   (`chromium --headless --ignore-certificate-errors --virtual-time-budget=6000 --screenshot=…`)
   contra o dev server em `https://localhost:1420` — `playwright-core` **não** está instalado no
   projeto e não deve ser adicionado só para isso.
4. Grep de regressão **nos arquivos que este passe toca** — zero ocorrências de `green-500`,
   `red-500`, `yellow-500`, `orange-500`, `gray-500`, `bg-zinc-`, e nenhum `bg-surface-*` com
   opacidade. O grep **não** pode varrer `apps/web/src` inteiro: `task-preview.tsx:181` e
   `premium.tsx:174`+ estão declarados fora de escopo e continuam com cor crua de propósito —
   um grep global falharia por design e treinaria todo mundo a ignorá-lo.
5. Todo crimson visível no dashboard mapeia num dos cinco papéis da tabela de §2 — inclusive nas
   sheets e modais abertos, onde a ação primária é uma só.
6. Tema claro: o dashboard herda `light-dark()` como a landing, mas nunca foi visto em claro depois
   do passe. Conferir especialmente as pills de prioridade e o dot/linha do "agora".
7. `prefers-reduced-motion`: lista sem stagger, sem crossfade na troca de view, e o tick da linha do
   "agora" **continua rodando** (é dado, não animação).

## Riscos

| Risco | Mitigação |
| --- | --- |
| Mover `TaskCard` quebrar a landing | os imports são poucos e o typecheck pega todos; screenshot da landing antes/depois no mesmo commit |
| Props opcionais incharem o `TaskCard` até virar dois componentes disfarçados | se `completed`+`priority`+`actions` exigirem mais de um branch cada, o certo é um `DayTaskCard` que compõe o `TaskCard` — decidir na fase 2, com o código na frente |
| Tokens de prioridade não passarem contraste sobre `surface-card` | os valores do §3 são ponto de partida; medir e ajustar o L antes de fechar a fase 0 |
| A pill crimson do "hoje" competir com o botão "Nova tarefa" na mesma tela | são os dois únicos crimsons do aside; se brigar, o "hoje" vira contorno em vez de fill |
| `--priority-4` no hue do crimson ler como ação | ele aparece só como ícone dentro de pill neutro, nunca como fill; verificar no screenshot |
| Sheet de leitura adicionar fricção a quem já usa o app | é a fase 4, isolada e cortável; se incomodar, o clique volta a abrir edição direto sem desfazer nada das fases anteriores |
| `profileTabs.tsx` (1074 linhas) estourar a fase 6 | escopo declarado é só vocabulário; qualquer reestruturação vira issue nova em vez de crescer a fase |
