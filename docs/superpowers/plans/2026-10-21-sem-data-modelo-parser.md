# Sem data — Plano A: modelo, servidor e parser

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O backend e o modelo compartilhado passam a suportar tarefas "Sem data" (com e sem recorrência), a preferência de primeiro dia da semana e o lembrete das recorrentes Sem data; o parser do composer passa a entender recorrência ("toda quarta").

**Architecture:** "Sem data" é uma flag `undated` na tarefa, não `date` nulo: `date` continua obrigatório e vira **âncora** (instante do lembrete quando há dia citado, senão o instante da criação). Isso evita o rebuild da tabela no SQLite e reaproveita inteiro o pipeline de alerta (avulso e de série). A leitura por mês exclui as Sem data; uma rota nova devolve todas. O período das recorrentes Sem data é derivado de `completed` + `periodStart` (puro, em `@dailify/shared`). A UI fica no Plano B.

**Tech Stack:** TypeScript · Hono + D1 (Cloudflare Workers) · vitest (`@cloudflare/vitest-pool-workers` no server) · bun workspaces.

**Spec:** `docs/superpowers/specs/2026-10-21-criacao-de-tarefas-design.md`

## Global Constraints

- Datas são epoch-ms `number` de ponta a ponta; fuso vem do cliente/assinatura, nunca do runtime (Worker = UTC).
- Sem `as` (exceto `as const`). Sem valores arbitrários de design (não se aplica a este plano, só UI).
- Todo body de tarefa passa por `apps/server/src/lib/task-input.ts`; erros via `fail(c, status, msg)`.
- Migration **aditiva** apenas (`ALTER TABLE … ADD COLUMN`, `CREATE TABLE`).
- Virada de período: **06:00** no fuso do usuário. Semana começa no `weekStart` do usuário (0=domingo … 6=sábado), default **1 (segunda)**.
- Recorrente Sem data com vários dias ("segunda e sexta", "dias úteis") = **uma marcação por semana**; cada dia citado só gera lembrete.
- Lembrete de tarefa com dia e sem horário: **09:00** (`DEFAULT_HOUR` existente). "Todo dia"/"todo mês" Sem data não têm lembrete.
- Comentários: só o não óbvio, uma linha (memória `code-style-comments`).
- Gate final: `bun run check` na raiz verde.

## Review Focus

1. Agora antes das 06:00 no dia que abre a semana → ainda é o período anterior (a tarefa continua marcada). → teste na Task 1.
2. Tarefa Sem data com âncora dentro do mês consultado **não** aparece em `GET /tasks?month=` nem é expandida como série. → teste na Task 2.
3. Cliente antigo (cache/PWA) manda `PATCH` sem `undated` → a tarefa não perde a flag. → teste na Task 2.
4. "reunião de quarta" **não** vira recorrência; "toda quarta" não deixa "quarta" sobrando no título. → teste na Task 5.
5. `PUT /settings` com `weekStart` 7, -1, "mon" → 400; conta excluída apaga as settings. → testes na Task 3.

---

### Task 1: Modelo compartilhado — flag `undated` e períodos

**Files:**
- Modify: `packages/shared/src/types.ts` (campo em `Task`)
- Modify: `packages/shared/src/hash.ts` (incluir `undated` no canonical)
- Create: `packages/shared/src/period.ts`, `packages/shared/src/period.test.ts`
- Modify: `packages/shared/src/index.ts` (re-export), `packages/shared/src/hash.test.ts`

**Interfaces:**
- Produces:
  - `Task.undated?: boolean` — `true` = Sem data; ausente/`false` = tarefa de agenda.
  - `type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6`; `const DEFAULT_WEEK_START: WeekStart = 1`; `const PERIOD_ROLLOVER_HOUR = 6`
  - `isWeekStart(value: unknown): value is WeekStart`
  - `periodStart(repeat: Exclude<Repeat, "Off">, now: number, weekStart: WeekStart, timeZone: string): number`
  - `doneThisPeriod(task: Pick<Task, "repeat" | "completed">, now: number, weekStart: WeekStart, timeZone: string): boolean` — `false` para `repeat === "Off"`.

- [ ] **Step 1: Testes que falham** em `period.test.ts` (fuso `America/Sao_Paulo`, sem DST hoje):
  - `periodStart("Daily", <2026-10-21 05:59 SP>, 1, tz)` === `<2026-10-20 06:00 SP>`; às `06:00` === `<2026-10-21 06:00 SP>`.
  - `periodStart({Weekly:["Wednesday"]}, <qua 2026-10-21 10:00>, 1, tz)` === `<seg 2026-10-19 06:00>`.
  - `weekStart=0`: `periodStart(weekly, <dom 2026-10-25 05:00>, 0, tz)` === `<dom 2026-10-18 06:00>` e às `<dom 2026-10-25 06:00>` === ela mesma.
  - `periodStart("Monthly", <2026-11-01 05:00>, 1, tz)` === `<2026-10-01 06:00>`; `"Yearly"` em `<2026-10-21>` === `<2026-01-01 06:00>`.
  - `doneThisPeriod` com `completed` = `[<seg 2026-10-19 08:00>]`, semanal, agora `<sex 2026-10-23>` → `true`; agora `<seg 2026-10-26 06:01>` → `false`; `repeat "Off"` → `false`.
  - `isWeekStart`: `0` e `6` true; `7`, `-1`, `1.5`, `"1"` false.
  - Em `hash.test.ts`: mesmo conteúdo com `undated: true` vs ausente → hashes diferentes; `undated: false` vs ausente → iguais.
- [ ] **Step 2:** `bun --filter @dailify/shared test` → FAIL (módulo/flag inexistentes).
- [ ] **Step 3: Implementar.** `periodStart`: desloca `now` −6h, lê `zonedParts` no fuso, recua até o início do período (dia; semana = `(weekday − weekStart + 7) % 7` dias; dia 1; 1º de janeiro) e devolve `zonedEpoch({…, hour: 6, minute: 0, second: 0}, tz)`. Weekday via o helper já usado em `recurrence.ts`. No hash, entra `task.undated === true` no array canonical.
- [ ] **Step 4:** `bun --filter @dailify/shared test` → PASS.
- [ ] **Step 5: Commit** `feat(shared): flag undated e periodStart/doneThisPeriod`

### Task 2: Servidor — persistir `undated` e ler as Sem data

**Files:**
- Create: `apps/server/migrations/0008_undated_settings.sql`
- Modify: `apps/server/src/db/tasks.ts` (`Row`, `rowToTask`, `insertStatement`, `updateTask`, `getMonthTasks`, `getRecurringTasks`, `countMonthlyTasks`, novo `getUndatedTasks`, `deleteUserData`)
- Modify: `apps/server/src/lib/task-input.ts` (campo `undated`)
- Modify: `apps/server/src/routes/tasks.ts` (`GET /undated`)
- Test: `apps/server/test/tasks-undated.test.ts`, `apps/server/test/task-input.test.ts`

**Interfaces:**
- Consumes: `Task.undated` (Task 1).
- Produces: `getUndatedTasks(db: D1Database, userId: string): Promise<Task[]>`; rota `GET /tasks/undated` → `{ tasks: Task[] }` (sem expansão; série volta como a linha mestre).

- [ ] **Step 1: Migration** `0008_undated_settings.sql`:
  ```sql
  ALTER TABLE tasks ADD COLUMN undated INTEGER NOT NULL DEFAULT 0;
  CREATE TABLE user_settings (user_id TEXT PRIMARY KEY, week_start INTEGER NOT NULL DEFAULT 1);
  ```
- [ ] **Step 2: Testes que falham** (`tasks-undated.test.ts`, estilo de `tasks-read.test.ts`):
  - `POST /tasks` com `undated: true` → resposta e `GET /tasks/undated` trazem `undated: true`.
  - Sem data **com âncora no mês** (avulsa e `Daily`) não aparecem em `GET /tasks?month=` (nem expandida).
  - `GET /tasks/undated` não traz tarefas de agenda nem de outro usuário.
  - `PATCH` só com `{ title }` numa Sem data → continua `undated: true`; `PATCH { undated: false }` → vira agenda e aparece no mês.
  - `task-input.test.ts`: `undated: "yes"` → `{ error: "invalid undated" }`; `undated: null` → campo ausente.
- [ ] **Step 3:** `bun --filter @dailify/server test` → FAIL.
- [ ] **Step 4: Implementar.** `Row.undated: number`; `rowToTask` → `undated: r.undated === 1 ? true : undefined`; coluna nas duas escritas (`insertStatement` inclusive no `DO UPDATE SET`, `updateTask`); `AND undated=0` em `getMonthTasks` e `getRecurringTasks`. `countMonthlyTasks` **não** filtra (Sem data conta no mês da âncora — *ajuste do spec*: dispensa a coluna `created_at`). `parseTaskFields`: boolean ou `null`/ausente, senão `"invalid undated"`. `deleteUserData` apaga também `user_settings`.
- [ ] **Step 5:** `bun --filter @dailify/server test` → PASS.
- [ ] **Step 6: Commit** `feat(server): tarefas Sem data (flag undated + GET /tasks/undated)`

### Task 3: Servidor — preferência de primeiro dia da semana

**Files:**
- Create: `apps/server/src/db/settings.ts`, `apps/server/src/routes/settings.ts`, `apps/server/test/settings.test.ts`
- Modify: `apps/server/src/index.ts` (mount + `PUT` no `allowMethods` do CORS)

**Interfaces:**
- Consumes: `WeekStart`, `isWeekStart`, `DEFAULT_WEEK_START` (Task 1); tabela `user_settings` (Task 2).
- Produces: `getWeekStart(db, userId): Promise<WeekStart>`; `setWeekStart(db, userId, weekStart: WeekStart): Promise<void>` (upsert); `GET /settings` → `{ weekStart }`; `PUT /settings` body `{ weekStart }` → `{ weekStart }`.

- [ ] **Step 1: Testes que falham:** GET sem linha → `{ weekStart: 1 }`; PUT `{weekStart: 0}` e depois GET → `0`; PUT com `7`, `-1`, `"mon"`, body vazio → 400; sem auth → 401; `deleteUserData` → GET volta ao default.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** com `requireAuth` + `rateLimit("API_LIMITER")` no grupo, validação por `isWeekStart`, erro `fail(c, 400, "invalid weekStart")`. Valor lido do D1 fora da faixa cai no default.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** `feat(server): GET/PUT /settings com weekStart`

### Task 4: Alertas — não lembrar recorrente Sem data já feita no período

**Files:**
- Modify: `apps/server/src/db/push.ts` (`recurringAlertCandidates` + `RecurringCandidate.weekStart`)
- Modify: `apps/server/src/alerts.ts` (`dueRecurring`)
- Test: `apps/server/test/alerts.test.ts`

**Interfaces:**
- Consumes: `doneThisPeriod` (Task 1), `user_settings` (Task 2).
- Produces: `RecurringCandidate.weekStart: WeekStart` (default se não houver linha).

- [ ] **Step 1: Testes que falham:** série Sem data `{Weekly:["Wednesday"]}` com `alert === date` (qua 09:00) e device inscrito: sem conclusão na semana → envia; com conclusão na segunda da mesma semana → **não** envia e **marca** `alert_sent` (não reavaliar a cada 5 min); série **de agenda** concluída continua enviando (comportamento atual intacto).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar:** `LEFT JOIN user_settings` no candidato; em `dueRecurring`, se `task.undated && doneThisPeriod(task, now, weekStart, timeZone)`, chamar `markOccurrenceAlerted(db, task.id, alertAt)` e pular o envio.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** `feat(alerts): recorrente Sem data concluída no período não notifica`

### Task 5: Parser — recorrência no texto

**Files:**
- Modify: `apps/web/src/functions/parse-task.ts`
- Test: `apps/web/src/functions/parse-task.test.ts`

**Interfaces:**
- Consumes: `Repeat`, `weekDays` de `@dailify/shared` (nomes em inglês: `"Wednesday"`).
- Produces: `ParsedTask.repeat: Repeat` (`"Off"` quando nada casou); `parseRepeat(text: string): { value: Exclude<Repeat, "Off">; spans: Span[] } | null` exportado pro teste.

- [ ] **Step 1: Testes que falham** (`now` fixo = qua 2026-10-21 10:00; checar `repeat`, `text`, `date`, `hasTime`):

  | entrada | `repeat` | `text` | data |
  | --- | --- | --- | --- |
  | `reunião toda quarta 16h` | `{Weekly:["Wednesday"]}` | `reunião` | qua 2026-10-21 16:00, `hasTime` |
  | `academia todas as segundas e sextas` | `{Weekly:["Monday","Friday"]}` | `academia` | sex 2026-10-23, `!hasTime` |
  | `stand-up dias úteis 9h` | `{Weekly:["Monday",…,"Friday"]}` | `stand-up` | qui 2026-10-22 09:00 (hoje já passou das 9h) |
  | `remédio todo dia 22h` / `todos os dias` / `diariamente` / `every day` | `"Daily"` | `remédio` | hoje 22:00 |
  | `regar plantas toda quarta-feira` | `{Weekly:["Wednesday"]}` | `regar plantas` | hoje, `!hasTime` |
  | `aluguel todo mês dia 5` | `"Monthly"` | `aluguel` | 2026-11-05 |
  | `toda semana` (sem dia) | `{Weekly:["Wednesday"]}` (dia de hoje) | — | — |
  | `aniversário da Ana todo ano 3 de março` | `"Yearly"` | `aniversário da Ana` | 2027-03-03 |
  | `every monday` | `{Weekly:["Monday"]}` | — | — |
  | `reunião de quarta 16h` | `"Off"` | `reunião` | qua 16:00 |

- [ ] **Step 2:** `bun --filter @dailify/web test parse-task` → FAIL.
- [ ] **Step 3: Implementar** `parseRepeat` sobre o texto normalizado (reaproveitar `WEEKDAYS` e `alternation`), gatilho obrigatório `tod[ao]s?|every|diariamente|semanalmente|mensalmente|anualmente|dias uteis`. Em `parseTaskText`, mascarar o span da recorrência antes do `parseWhen` (mesmo padrão do `mask` da duração), exceto o "dia 5"/"3 de março" que o `parseWhen` precisa ler. Sem dia explícito, a data é a próxima ocorrência a partir de hoje (inclusive hoje se o horário ainda não passou ou se não há horário).
- [ ] **Step 4:** rodar → PASS, e a suíte antiga do parser continua verde.
- [ ] **Step 5: Commit** `feat(parser): recorrência no texto do composer (Dailify-p84)`

### Task 6: Composer usa a recorrência do parser

**Files:**
- Modify: `apps/web/src/pages/home.tsx` (`composerTaskInput`), `apps/web/src/components/dashboard/task-composer.tsx` (chip de recorrência no eco, usando `functions/repeat-label.ts`)
- Test: `apps/web/src/functions/repeat-label.test.ts` (se o rótulo precisar de caso novo)

**Interfaces:**
- Consumes: `ParsedTask.repeat` (Task 5).
- Produces: nada novo; `composerTaskInput` passa `repeat: parsed.repeat` e o `bumpUsage("recurring")` já existente cobre a quota.

- [ ] **Step 1:** trocar `repeat: "Off"` por `parsed.repeat`; mostrar o chip de recorrência no eco do composer. Tarefas **sem horário continuam indo para a agenda às 09:00** até o Plano B (sem a coluna, uma Sem data sumiria da tela).
- [ ] **Step 2:** `bun run check` na raiz → verde. Conferir no app (`bun run dev`): "reunião toda quarta 16h" cria a série e ela aparece nas quartas do mês.
- [ ] **Step 3: Commit** `feat(composer): "toda quarta" cria tarefa recorrente`; `bd close Dailify-p84`.
