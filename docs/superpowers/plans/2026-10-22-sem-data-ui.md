# Sem data — Plano B: UI (coluna, swipe, botão flutuante, folha, edição, semana)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O usuário cria tarefas por um botão flutuante + folha; o que não tem horário vai para a lista **Sem data** (coluna no desktop, tela por swipe no mobile), com recorrentes que ficam marcadas até o período virar; a edição troca entre agenda e Sem data; a configuração define o primeiro dia da semana.

**Architecture:** O web app ganha um segundo conjunto de tarefas, `undatedTasks`, no contexto — separado de `tasks` porque `upsertTaskWithRecurrence` expandiria séries Sem data na agenda. Uma regra pura (`composeTaskInput`) decide agenda vs. Sem data a partir do parser. As ações das Sem data vivem num hook próprio. Layout: a `home.tsx` vira uma linha flex (agenda | coluna) no desktop e um pager de duas telas no mobile; o composer centralizado sai e entra dentro de uma folha (Radix Dialog) aberta pelo botão flutuante.

**Tech Stack:** React 18 · framer-motion 12 · Tailwind v4 (tokens em `global.css`) · shadcn/Radix · vitest + RTL (jsdom) · Plano A já em `main` (`GET /tasks/undated`, `GET/PUT /settings`, `doneThisPeriod`, `Task.undated`).

**Spec:** `docs/superpowers/specs/2026-10-21-criacao-de-tarefas-design.md`

## Global Constraints

- Só entra na lista do dia o que tem **horário**. Sem horário → Sem data. Sem horário com dia → Sem data com lembrete às **09:00** daquele dia (`alert = date`).
- Recorrente sem horário → Sem data, seção **Recorrentes** no topo; marcada até o período virar (`doneThisPeriod`, virada **06:00**, semana pelo `weekStart`). Vários dias citados = **uma marcação por semana**. "todo dia"/"todo mês" sem dia citado: **sem lembrete**.
- Puxador desktop: borda direita, centralizado na vertical, **mais alto que largo (3:4)**, metade fora da tela. A coluna é **coluna do layout** (a agenda encolhe), não drawer.
- Mobile: Sem data é **outra tela** por **swipe horizontal**; o swipe de um card (completar/excluir) continua do card.
- Botão flutuante "+" no canto inferior direito; a folha de criação sobe colada ao teclado no mobile. Na tela/coluna Sem data, o "+" cria sem data.
- Preferência `weekStart` 0–6, default **1 (segunda)**, persistida no servidor.
- Design tokens only (sem `bg-[#…]`, `rounded-[…]`, `p-[…]`); token novo = valor em `:root` + mapeamento em `@theme inline`, com o porquê num comentário. Sem `as`. Comentários só no não óbvio (uma linha). Strings de UI em `components/dashboard/copy.ts`.
- Toda animação: ≤300ms, só `transform`/`opacity`, respeita `prefers-reduced-motion` (vira fade/instantâneo). Ver `docs/research/2026-10-21-microanimacoes.md`.
- Gate final: `bun run check` verde. Verificação visual no navegador fica para o usuário.

## Review Focus

1. Série Sem data **não** pode aparecer na agenda depois de qualquer ação (completar, editar, criar offline, recarregar do cache). → testes Tasks 1, 2 e 6.
2. Desfazer a marcação de uma recorrente Sem data feita na segunda, estando na sexta → remove a conclusão do **período**, não só do dia. → teste Task 3.
3. Composer sem data e sem texto de dia ("comprar pão") deve poder ser enviado (hoje o botão exige data). → teste Task 2.
4. Swipe de card no mobile não troca de tela; swipe na área livre troca. → teste Task 5 (`dragPropagation`/alvo).
5. Usuário offline: criar Sem data entra na fila e aparece na coluna; voltar online não duplica. → teste Task 1/2.

---

### Task 1: Dados — Sem data e `weekStart` no cliente

**Files:**
- Modify: `apps/web/src/functions/api.ts` (novas funções), `apps/web/src/functions/offline.ts` (cache das Sem data), `apps/web/src/components/dailifyContext.tsx`, `apps/web/src/components/protected-route.tsx`
- Create: `apps/web/src/functions/undated.ts`, `apps/web/src/functions/undated.test.ts`

**Interfaces:**
- Produces:
  - `getUndatedTasks(token: string): Promise<{ tasks: Task[]; error?: ApiError }>`
  - `getSettings(token: string): Promise<{ weekStart?: WeekStart; error?: ApiError }>`; `saveSettings(token: string, weekStart: WeekStart): Promise<{ weekStart?: WeekStart; error?: ApiError }>`
  - `uncompleteTaskRange(token: string, id: string, from: number, to: number)` — mesmo retorno de `uncompleteTask`; `uncompleteTask` passa a delegar a ela.
  - `readCachedUndated(userId: string): Task[] | undefined`; `cacheUndated(userId: string, tasks: Task[]): void` (chave `dailify:undated:${userId}`; `clearLocal` apaga também).
  - Contexto: `undatedTasks: Task[] | undefined`, `setUndatedTasks(tasks: Task[])`, `weekStart: WeekStart`, `setWeekStart(w: WeekStart)` (default `DEFAULT_WEEK_START`).
  - `functions/undated.ts` (puro): `upsertUndated(list: Task[], task: Task): Task[]` (substitui por id, senão anexa); `removeUndated(list: Task[], id: string): Task[]`; `splitUndated(list: Task[], now: number, weekStart: WeekStart, tz: string): { recurring: Task[]; todo: Task[] }` — `recurring` = `repeat !== "Off"` (todas, marcadas ou não), `todo` = avulsas **sem** conclusão; ordem estável por `date`.

- [ ] **Step 1: Testes que falham** (`undated.test.ts`): `upsertUndated` substitui mantendo posição e anexa novo; `removeUndated`; `splitUndated` separa série e avulsa, esconde avulsa concluída, mantém série concluída.
- [ ] **Step 2:** `bun --filter @dailify/web test undated` → FAIL.
- [ ] **Step 3: Implementar** helpers + api (padrão `request<…>` existente) + contexto + `protected-route.tsx`: buscar Sem data e settings junto do billing (sem dependência de mês), revalidar no mesmo efeito de visibilidade/online, boot pelo cache, `cacheUndated` a cada mudança. A fila offline já reenvia `create`/`complete`/… pelas rotas de sempre; nada muda nela.
- [ ] **Step 4:** testes → PASS; `bun run check` → verde.
- [ ] **Step 5: Commit** `feat(web): Sem data e weekStart no contexto`

### Task 2: Regra de destino do composer

**Files:**
- Create: `apps/web/src/functions/compose-input.ts`, `apps/web/src/functions/compose-input.test.ts`
- Modify: `apps/web/src/functions/parse-task.ts` (`ParsedTask.hasDay`), `apps/web/src/pages/home.tsx` (usa a regra; tira `composerTaskInput` local), `apps/web/src/components/dashboard/task-composer.tsx` (`canSubmit` só exige texto; prop `undatedOnly?: boolean` ignora data/hora do parser)

**Interfaces:**
- Consumes: `ParsedTask` (+ `hasDay: boolean` = dia explícito **ou** recorrência semanal com dias citados).
- Produces: `composeTaskInput(parsed: ParsedTask, now: Date, opts?: { undatedOnly?: boolean }): TaskInput`; `DEFAULT_HOUR = 9` e `DEFAULT_DURATION = "10m"` passam a viver aqui.

- [ ] **Step 1: Testes que falham** (now = qua 2026-10-21 10:00):

  | entrada | `undated` | `date` | `alert` | `repeat` |
  | --- | --- | --- | --- | --- |
  | `reunião qui 16h` | ausente | qui 22 16:00 | ausente | Off |
  | `comprar pão` | `true` | now | ausente | Off |
  | `pagar boleto qui` | `true` | qui 22 09:00 | = date | Off |
  | `regar plantas toda quarta` | `true` | qua 21 09:00 | = date | Weekly[Wednesday] |
  | `meditar todo dia` | `true` | now | ausente | Daily |
  | `aluguel todo dia 5` | `true` | 2026-11-05 09:00 | = date | Monthly |
  | `academia toda segunda 7h` | ausente | seg 26 07:00 | ausente | Weekly[Monday] |
  | `reunião qui 16h` com `undatedOnly` | `true` | qui 22 09:00 | = date | Off |

  E em `parse-task.test.ts`: `hasDay` true para "qui", "toda quarta"; false para "comprar pão", "todo dia".
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.** `home.tsx`: `handleCompose` usa `composeTaskInput`; resultado `undated` vai para `undatedTasks` via `upsertUndated` (otimista + resposta), senão segue o caminho atual de `tasks`. Toast de criação diz o destino (`copy.form.createdUndated`).
- [ ] **Step 4:** testes → PASS; `bun run check`.
- [ ] **Step 5: Commit** `feat(composer): sem horário vai para Sem data`

### Task 3: Lista Sem data (seções, marcação por período, histórico)

**Files:**
- Create: `apps/web/src/hooks/useUndatedActions.tsx`, `apps/web/src/components/dashboard/undated-list.tsx`, `apps/web/src/components/dashboard/check-history.tsx`, `apps/web/src/components/dashboard/undated-list.render.test.tsx`
- Modify: `apps/web/src/components/dashboard/copy.ts` (namespace `undated`)

**Interfaces:**
- Consumes: Task 1 (`undatedTasks`, `setUndatedTasks`, `weekStart`, helpers, `uncompleteTaskRange`), `doneThisPeriod`/`periodStart` de `@dailify/shared`.
- Produces:
  - `useUndatedActions(task: Task): { done: boolean; toggle(): Promise<void>; remove(): Promise<void> }` — `done` = recorrente: `doneThisPeriod`; avulsa: `completed.length > 0`. `toggle` desfaz removendo `[periodStart, now]` (recorrente) ou tudo (avulsa). Otimista, offline pela fila (`complete`/`uncomplete`/`delete`), rollback + toast no erro, desfazer no toast de excluir (padrão de `useTaskActions`).
  - `<UndatedList className? />` — seção "Recorrentes" (se houver) e lista de afazeres; vazio = `copy.undated.empty`. Linha reaproveita `TaskCard` (sem horário; chip de lembrete quando há `alert`; chip de recorrência via `repeatLabel`). Toque abre a edição (`EditTask`). Mobile: `SwipeActions` nos cards.
  - `<CheckHistory task: Task; weekStart: WeekStart; periods?: number />` — uma bolinha por período desde a criação (máx. `periods`, default 12), cheia se houve conclusão naquele período. `aria-label` com a contagem.

- [ ] **Step 1: Testes que falham** (render, jsdom, contexto mockado como em `quota-bar.render.test.tsx`): série marcada nesta semana aparece marcada; avulsa concluída some; vazio mostra `copy.undated.empty`; `CheckHistory` com 3 conclusões em semanas distintas → 3 bolinhas cheias. Hook (teste unitário com `fetch` mockado ou via helpers puros): desmarcar na sexta remove a conclusão de segunda (chama `uncompleteTaskRange` com `from = periodStart`).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.** Marcar/desmarcar com microinteração mínima (check desenhado ≤200ms ou só troca de estado, reduced-motion respeitado).
- [ ] **Step 4:** testes → PASS; `bun run check`.
- [ ] **Step 5: Commit** `feat(web): lista Sem data com recorrentes por período e histórico`

### Task 4: Desktop — coluna Sem data + puxador

**Files:**
- Create: `apps/web/src/components/dashboard/undated-column.tsx`
- Modify: `apps/web/src/pages/home.tsx` (linha flex: agenda | coluna), `apps/web/src/global.css` (tokens do puxador/coluna se faltarem), `copy.ts`

**Interfaces:**
- Consumes: `<UndatedList/>` (Task 3), `undatedTasks` (Task 1).
- Produces: `<UndatedColumn open: boolean; onOpenChange(open: boolean) />` — só `md:` e acima.

- [ ] **Step 1: Teste que falha** (render): fechado → só o puxador, com `aria-label` "Abrir Sem data (N pendentes)" e `aria-expanded=false`; clicar → coluna presente e `aria-expanded=true`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.** Coluna é irmã da agenda num `flex`; abre animando largura de 0 até um token novo `--width-undated` (≈ 20rem) — exceção registrada: largura é layout, então animar `width` aqui é a forma de a agenda encolher; usar `transition` CSS com `--ease-out-expo`/200ms e `motion-reduce:transition-none`. Puxador: `fixed`, `right-0`, `top-1/2`, proporção 3:4 com metade para fora (`translate-x-1/2`), mostra a contagem; quando aberto acompanha a borda da coluna e vira "fechar". Estado aberto lembrado por device (`localStorage` em try/catch). Atalho: nenhum.
- [ ] **Step 4:** testes → PASS; `bun run check`.
- [ ] **Step 5: Commit** `feat(web): coluna Sem data no desktop`

### Task 5: Mobile — pager Hoje | Sem data

**Files:**
- Create: `apps/web/src/components/dashboard/mobile-pager.tsx`
- Modify: `apps/web/src/pages/home.tsx`, `copy.ts`

**Interfaces:**
- Consumes: `<UndatedList/>` (Task 3), agenda atual (`WeekStrip` + `DayList`).
- Produces: `<MobilePager pages: [ReactNode, ReactNode]; index: 0 | 1; onIndexChange(i: 0 | 1) />` — só abaixo de `md`.

- [ ] **Step 1: Teste que falha** (render): indicador com 2 itens e `aria-current` no ativo; tocar no indicador troca `index`; teclado (setas) troca.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** com framer `drag="x"` + `dragDirectionLock` no trilho, snap por distância (> 1/4 da largura) **ou** velocidade (> 400px/s), spring `{ type: "spring", visualDuration: 0.2, bounce: 0 }`; os `SwipeActions` dos cards não propagam o drag (padrão do framer, `dragPropagation` desligado) — conferir que um swipe iniciado num card não move o pager. Reduced motion: troca instantânea.
- [ ] **Step 4:** testes → PASS; `bun run check`.
- [ ] **Step 5: Commit** `feat(web): pager Hoje | Sem data no mobile`

### Task 6: Botão flutuante + folha de criação

**Files:**
- Create: `apps/web/src/components/dashboard/create-fab.tsx`, `apps/web/src/components/dashboard/create-fab.render.test.tsx`
- Modify: `apps/web/src/pages/home.tsx` (remove o slot centralizado e `COMPOSER_HEIGHT`/`ECHO_HEIGHT`/`STRIP_*`/`useHeight` se ficarem sem uso), `task-composer.tsx` (atalho global vira "abrir a folha"; `autoFocus`), `apps/web/index.html` (`interactive-widget=resizes-content` no viewport, para a folha subir com o teclado), `copy.ts`

**Interfaces:**
- Consumes: `TaskComposer` (+ `undatedOnly`), `handleCompose` de `home.tsx`.
- Produces: `<CreateFab onSubmit(values: ComposerValues): void; submitting?: boolean; undatedOnly?: boolean />`.

- [ ] **Step 1: Teste que falha** (render): botão com `aria-label` "Nova tarefa"; clicar abre diálogo com o campo focado; tecla `n` (fora de campo) abre; `Esc` fecha; enviar chama `onSubmit` e fecha.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** com Radix `Dialog` (`ui/dialog.tsx`): mobile = painel colado ao rodapé, largura total, cantos de cima `rounded-panel`; desktop = painel ancorado acima do botão, largura de token. Entrada: `opacity` + `scale(0.95)` com `transform-origin` no canto do botão (aproximação do morph; o morph com `layoutId` fica no épico Dailify-dgb). `pb` com `env(safe-area-inset-bottom)` via utility existente ou token novo. Botão some enquanto a folha está aberta. Na tela/coluna Sem data, `undatedOnly`.
- [ ] **Step 4:** testes → PASS; `bun run check`.
- [ ] **Step 5: Commit** `feat(web): botão flutuante abre a folha de criação`

### Task 7: Edição — "sem horário" move entre agenda e Sem data

**Files:**
- Modify: `apps/web/src/components/dashboard/task-form.tsx` (`TaskFormValues.undated: boolean`, linha "Sem horário" + data só-dia opcional para o lembrete), `apps/web/src/components/edit-task.tsx` (`save` move a tarefa entre `tasks` e `undatedTasks`), `copy.ts`
- Create: `apps/web/src/functions/edit-input.ts`, `apps/web/src/functions/edit-input.test.ts`

**Interfaces:**
- Produces: `editTaskInput(values: TaskFormValues, now: Date): Partial<TaskInput>` — `undated: true` → `date` = dia do lembrete às 09:00 com `alert = date`, ou `now` sem `alert` se o dia foi limpo; `undated: false` → `date` = data+hora do form, `undated: false`, `alert` mantém a regra atual.

- [ ] **Step 1: Testes que falham** (`edit-input.test.ts`): agenda → Sem data com dia (09:00, alert); Sem data → agenda (sai `undated`, `date` com hora); Sem data sem lembrete (`alert` ausente).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar.** Em `save`, após `updateTask`: se mudou de lado, `removeUndated`/`upsertUndated` e remover/inserir em `tasks` (`upsertTaskWithRecurrence` só para agenda). Série Sem data não abre o `RecurrenceScopeDialog` (não há ocorrência a destacar).
- [ ] **Step 4:** testes → PASS; `bun run check`.
- [ ] **Step 5: Commit** `feat(edit): sem horário move a tarefa para Sem data`

### Task 8: Configuração — primeiro dia da semana

**Files:**
- Modify: `apps/web/src/pages/settings.tsx` (card novo), `apps/web/src/components/dashboard/mini-calendar.tsx` (`startOfWeek(monthStart, { weekStartsOn: weekStart })`), `copy.ts`
- Create: `apps/web/src/components/week-start-select.tsx`, `apps/web/src/components/week-start-select.render.test.tsx`

**Interfaces:**
- Consumes: `weekStart`/`setWeekStart` (Task 1), `saveSettings` (Task 1), `copy.form.repeatDays`.
- Produces: `<WeekStartSelect />` — `ToggleGroup type="single"` com 7 dias (rótulos curtos), otimista com rollback + toast no erro.

- [ ] **Step 1: Teste que falha** (render): mostra o valor do contexto marcado; escolher domingo chama `saveSettings(token, 0)` e `setWeekStart(0)`; erro da API → volta ao anterior.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar**; mini-calendário começa no `weekStart`.
- [ ] **Step 4:** testes → PASS; `bun run check`.
- [ ] **Step 5: Commit** `feat(settings): primeiro dia da semana`; `bd close Dailify-1xr`.
