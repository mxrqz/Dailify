# Lista contínua — todas as tarefas daqui pra frente, sem loading

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** A agenda deixa de ser "hoje até o fim do mês selecionado" e vira uma lista contínua a partir de hoje, que carrega o próximo mês ANTES de o usuário chegar no fim (sem spinner, sem "carregando"). Clicar num dia (faixa da semana ou mini-calendário) carrega até aquele mês se preciso e rola até o dia.

## Decisões do usuário (2026-10-31)

- Infinite scroll invisível: nada de loading no fim da lista — o próximo mês já tem que estar lá quando a rolagem chegar.
- Começa em hoje; o passado não entra na lista contínua. Dia passado escolhido no calendário: a lista passa a começar nele.
- Dia clicado sem tarefa aparece mesmo assim, com uma linha "Nada neste dia" (copy).
- Recorrentes se repetem em todos os meses carregados (o servidor já expande por mês).

## Estado atual (pra quem implementa)

- `protected-route.tsx` `getTasks` busca `getTasksForMonth(token, selectedDay)` e SUBSTITUI `tasks` ao trocar de mês; `currentMonth` controla o refetch.
- O servidor expande recorrência por mês; instâncias dividem o `id` da original. `upsertTaskWithRecurrence(tasks, task, month)` reconstrói as instâncias de UM mês — chamado com `selectedDay` em `useCreateTask`, `useTaskActions`, `edit-task`.
- `DayList` monta os dias de `start` até `endOfMonth(selectedDay)`. `WeekStrip.goTo` faz `scrollIntoView` no `dayAnchorId(day)`; some se o dia não está na lista.
- Cache offline (`cacheTasks`) guarda `tasks` como estão.

## Global Constraints

- Sem `as`; strings em `copy.ts`; comentários só no não óbvio, uma linha pt-BR; tokens only; Prettier 100; motion via `consts/motion.ts`.
- Commits SEM `Co-Authored-By`. SEM `git push`. Gate `bun run check` verde em cada task.
- Não mexer no servidor: um mês por request continua sendo o contrato.

---

### Task 1: Camada de dados multi-mês

**Files:** `components/dailifyContext.tsx`, `components/protected-route.tsx`, `functions/functions.ts` (+ teste), `hooks/useCreateTask.ts`, `hooks/useTaskActions.tsx`, `components/edit-task.tsx`.

- Contexto ganha `loadedMonths: Date[]` (início de mês, ordenados) e `loadMonth(month: Date): Promise<void>` (idempotente: mês já carregado ou em voo não refaz).
- Merge por mês: `mergeMonth(tasks, month, fetched)` = tarefas cuja `date` NÃO cai em `month` + `fetched`. Função pura, testada (inclui recorrente com instâncias em dois meses).
- Carga inicial: mês de hoje e o seguinte (prefetch). `selectedDay` em outro mês continua funcionando (carrega aquele mês), mas não substitui mais a lista inteira.
- `upsertTaskWithRecurrence(tasks, task, months: Date[])` reconstrói as instâncias em todos os meses carregados; todos os chamadores passam `loadedMonths`. Testes atualizados.
- Refresh (volta do segundo plano, fila offline) recarrega os meses carregados, não só um.
- `currentMonthTasks`/quota continuam com o mês de hoje.
- Commit `feat(web): agenda carrega e mescla vários meses`.

### Task 2: `DayList` contínua com prefetch invisível

**Files:** `components/dashboard/day-list.tsx` (+ render test).

- Dias de `start` (hoje, ou o dia passado escolhido) até o fim do ÚLTIMO mês carregado; só dias com tarefa (+ hoje com o bloco "A qualquer hora", regra atual; + o dia-alvo de um clique, Task 3).
- Sentinela no fim com `IntersectionObserver` e `rootMargin` grande (≈ 2 telas, ex. `"0px 0px 200% 0px"`): ao cruzar, `loadMonth(próximo)`. Sem spinner, sem texto de carregando. Se o mês carregado não tiver tarefa, a sentinela continua visível e o próximo é pedido (limite de segurança: no máximo 12 meses à frente de hoje sem nenhuma tarefa → para).
- Estados vazios atuais (primeiro uso / nada agendado) só depois de os 2 meses iniciais carregarem.
- Commit `feat(web): lista contínua com o próximo mês carregado antes do fim`.

### Task 3: Ir até o dia

**Files:** `components/dashboard/week-strip.tsx`, `components/dashboard/mini-calendar.tsx`, `day-list.tsx`/`day-section.tsx`, `copy.ts`, testes.

- Contexto (ou estado em `home`) guarda `targetDay`. Clicar num dia: `await loadMonth(mês do dia)` (e os meses no meio, pra não deixar buraco), seta `targetDay`, e após o render rola até `dayAnchorId` (`behavior: "smooth"`, `block: "start"`; reduced motion → `"auto"`).
- O dia-alvo sem tarefa entra na lista com a linha `copy.day.emptyDay` ("Nada neste dia").
- Mini-calendário: escolher dia passado faz a lista começar nele; dia futuro só rola.
- Commit `feat(web): clicar num dia rola até ele, carregando o mês se preciso`.
