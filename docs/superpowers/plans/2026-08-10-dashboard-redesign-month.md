# Dashboard redesign — fase 3: view do mês

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar a view do mês (`calendar-view.tsx`) ao mesmo vocabulário da view do dia, fechando a inconsistência mais visível que o plano do núcleo deixou: hoje o toggle Hoje/Mês leva a uma tela que não passou pelo passe.

**Architecture:** Reescrita de `calendar-view.tsx` como `dashboard/month-view.tsx`, seguindo a janela + chrome que a `DayView` estabeleceu. A Sheet do dia deixa de ter sua própria lista de tarefas e passa a montar `DayTaskRow`, o que elimina a última cópia do agrupamento por horário e dá ao mês as mesmas ações (concluir/editar/excluir) de graça.

**Tech Stack:** React 18 + TypeScript + Vite · Tailwind v4 · framer-motion · date-fns (`ptBR`) · lucide-react · vitest · bun

## Global Constraints

Iguais às do plano do núcleo (`2026-08-10-dashboard-redesign-core.md`), repetidas aqui porque cada plano é lido isolado:

- **Sem `as` type assertions.** `as const` é permitido. Use type guards.
- **Sem hex, sem cor arbitrária.** Só tokens; cor nova = token em `global.css` + `@theme inline`.
- **Sem `/opacity` em elemento interativo ou superfície.** Exceções: `shadow-[…var(--accent-glow)]` e os focus rings do shadcn (`ring-ring/50`), que o `components/ui/CLAUDE.md` manda deixar.
- **Escada:** `surface-page` (shell) → `surface-card` (janelas) → célula/cartão **sem fill**, só `border-surface-line`; `surface-hover` no hover. **Nunca** `surface-raised`, `surface-panel`, `surface-slab*`, `surface-ink*`.
- **Crimson só nos cinco papéis:** ação primária · view ativa · hoje · agora · tarefa aberta.
- **Mono para dado de máquina** (`font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground`), sans para texto humano; secundário é `text-content-secondary`.
- **Toda string visível, inclusive `aria-label`, vem de `components/dashboard/copy.ts`.**
- **Todo bloco animado lê `useReducedMotion()`.**
- **A semana começa no DOMINGO.** `weekDays` (`consts/conts.ts`) indexa `0=Sunday` e `packages/shared/src/recurrence.ts` casa `repeat.Weekly` por esse índice — **nunca traduza nem reordene esse array.** Rótulos de exibição vêm de `copy.aside.weekDayInitials`.
- **O gate é `bun run check` com exit 0** — não os subcomandos. Ele é `prettier --check src && eslint src && tsc --noEmit && vitest run`, e o format roda primeiro e curto-circuita o resto. Warnings de lint devem ficar em **42** e não subir.
- **bun** é o package manager. Nenhuma dependência nova.

---

### Task 1: `MonthView` — janela, chrome e grid

`calendar-view.tsx` hoje é uma `motion.ul` solta com três botões `variant="outline"` no topo, células `bg-background`/`bg-muted` e `rounded-md`. Vira uma janela igual à do dia.

**Files:**
- Create: `apps/web/src/components/dashboard/month-view.tsx`
- Modify: `apps/web/src/pages/home.tsx` (troca `CalendarView` por `MonthView`)
- Modify: `apps/web/src/components/dashboard/copy.ts` (seção `month`)
- Delete: `apps/web/src/components/calendar-view.tsx` (ao final da Task 2, não aqui)

**Interfaces:**
- Consumes: `useDailify`, `getTasksForDay`, `groupTasksByTime`, `copy`, `useNow` (não usado aqui, mas disponível)
- Produces: `<MonthView />`

- [ ] **Step 1: Add the month copy**

Em `apps/web/src/components/dashboard/copy.ts`, adicione uma seção `month` depois de `aside`:

```ts
  month: {
    today: "Hoje",
    prevMonth: "Mês anterior",
    nextMonth: "Próximo mês",
    goToToday: "Ir para hoje",
    moreTasks: "+{n}",
    sheetTitle: "Tarefas do dia",
    sheetEmpty: "Nenhuma tarefa neste dia.",
  },
```

`moreTasks` usa `{n}` como placeholder — quem renderiza faz `copy.month.moreTasks.replace("{n}", String(extra))`. É a única string com interpolação no dicionário; mantenha o padrão se precisar de outra.

- [ ] **Step 2: Write `MonthView`**

Create `apps/web/src/components/dashboard/month-view.tsx`:

```tsx
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { MonthDayCell } from "@/components/dashboard/month-day-cell";
import { Button } from "@/components/ui/button";
import { getTasksForDay } from "@/functions/functions";
import { cn } from "@/lib/utils";

/**
 * View do mês — a mesma janela da `DayView`: chrome com o mês e a navegação, e o grid por baixo.
 * A célula vive em `month-day-cell.tsx` porque ela cresceu o bastante para ter vida própria
 * (estado de hoje/selecionado/fora-do-mês + a lista de tarefas + a sheet).
 *
 * A semana começa no DOMINGO, como todo o resto do app (`weekDays` em consts indexa 0=Sunday e a
 * recorrência semanal depende disso). Os rótulos vêm de `copy.aside.weekDayInitials`.
 */
export function MonthView(): JSX.Element {
  const { selectedDay, setSelectedDay, tasks } = useDailify();
  const reduce = useReducedMotion();

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(selectedDay)),
    end: endOfWeek(endOfMonth(selectedDay)),
  });

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.25, ease: "easeOut" }}
      className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-surface-line bg-surface-card shadow-panel"
    >
      <header className="flex items-center justify-between border-b border-surface-line px-6 py-4">
        <span className="text-sm font-medium text-foreground">
          {format(selectedDay, "MMMM yyyy", { locale: ptBR })}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.month.prevMonth}
            onClick={() => setSelectedDay(subMonths(selectedDay, 1))}
            className="size-8 rounded-full text-muted-foreground hover:bg-surface-hover"
          >
            <ChevronLeft className="size-4" />
          </Button>

          <Button
            variant="ghost"
            onClick={() => setSelectedDay(new Date())}
            className="h-8 rounded-full px-3 font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            {copy.month.today}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label={copy.month.nextMonth}
            onClick={() => setSelectedDay(addMonths(selectedDay, 1))}
            className="size-8 rounded-full text-muted-foreground hover:bg-surface-hover"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-6">
        <div className="grid grid-cols-7 gap-1">
          {copy.aside.weekDayInitials.map((label, index) => (
            <span
              key={index}
              className="text-center font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>

        <div className="grid flex-1 auto-rows-fr grid-cols-7 gap-1">
          {days.map((day) => (
            <MonthDayCell
              key={day.toISOString()}
              day={day}
              tasks={tasks ? getTasksForDay(tasks, day) : []}
              isCurrentMonth={isSameMonth(day, selectedDay)}
              isSelected={isSameDay(day, selectedDay)}
              isCurrentDay={isToday(day)}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
```

Note que o `cn` importado só é usado se você precisar dele; se o lint reclamar de import não usado, remova-o.

**Atenção ao `startOfWeek` sem locale:** é deliberado. O default do date-fns é domingo, que é o que o app usa. Passar `{ locale: ptBR }` como o arquivo antigo fazia dá no mesmo (ptBR também é `weekStartsOn: 0`), mas sem o locale a intenção fica explícita e não depende de um detalhe do locale.

- [ ] **Step 3: Point `home.tsx` at it**

Em `apps/web/src/pages/home.tsx`, troque o import de `CalendarView` por `import { MonthView } from "@/components/dashboard/month-view";` e o uso `<CalendarView />` por `<MonthView />`.

- [ ] **Step 4: Typecheck**

Run: `bun --filter @dailify/web typecheck`
Expected: FAIL com um erro só — `@/components/dashboard/month-day-cell` não existe. É a Task 2.

- [ ] **Step 5: Do NOT commit yet**

A árvore fica quebrada de propósito até a Task 2, como aconteceu nas Tasks 8–10 do plano do núcleo. O commit sai no fim da Task 2.

---

### Task 2: `MonthDayCell` — a célula e a sheet do dia

A célula antiga (`calendar-view.tsx:156-274`) tinha a lista de tarefas do dia inline dentro da Sheet, com sua própria cópia do `reduce` de agrupamento e seu próprio card. Agora ela monta `DayTaskRow`, que já traz cartão, ações e edição.

**Files:**
- Create: `apps/web/src/components/dashboard/month-day-cell.tsx`
- Delete: `apps/web/src/components/calendar-view.tsx`

**Interfaces:**
- Consumes: `DayTaskRow` (fase 2), `groupTasksByTime`, `copy`, `tagsBgColors2`
- Produces: `<MonthDayCell day tasks isCurrentMonth isSelected isCurrentDay />`

- [ ] **Step 1: Write the cell**

Create `apps/web/src/components/dashboard/month-day-cell.tsx`:

```tsx
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DayTaskRow } from "@/components/dashboard/day-task-row";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { tagsBgColors2 } from "@/consts/conts";
import { groupTasksByTime } from "@/functions/functions";
import { cn } from "@/lib/utils";
import type { TaskProps } from "@/types/types";

/** Quantas tarefas aparecem na célula antes de virar "+N". */
const MAX_VISIBLE = 3;

/**
 * Uma célula do grid do mês. Sem fill — só hairline —, seguindo a mesma regra do cartão de tarefa:
 * a janela já é o contêiner, a célula precisa de separação e não de elevação.
 *
 * Clicar abre a sheet do dia, que monta `DayTaskRow` — então concluir/editar/excluir funcionam aqui
 * exatamente como na view do dia, sem uma segunda implementação.
 */
export function MonthDayCell({
  day,
  tasks,
  isCurrentMonth,
  isSelected,
  isCurrentDay,
}: {
  day: Date;
  tasks: TaskProps[];
  isCurrentMonth: boolean;
  isSelected: boolean;
  isCurrentDay: boolean;
}): JSX.Element {
  const { setSelectedDay } = useDailify();
  const visible = tasks.slice(0, MAX_VISIBLE);
  const extra = tasks.length - visible.length;
  const groups = groupTasksByTime(tasks);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          onClick={() => setSelectedDay(day)}
          aria-label={format(day, "d 'de' MMMM", { locale: ptBR })}
          className={cn(
            "flex h-full flex-col items-stretch gap-1 rounded-lg border p-2 text-left transition-colors",
            isSelected ? "border-foreground" : "border-surface-line",
            "hover:bg-surface-hover",
          )}
        >
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs",
              isCurrentDay && "bg-accent-primary text-primary-foreground",
              !isCurrentDay && isCurrentMonth && "text-foreground",
              !isCurrentDay && !isCurrentMonth && "text-muted-foreground",
            )}
          >
            {format(day, "d")}
          </span>

          {isCurrentMonth && visible.length > 0 && (
            <ul className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
              {visible.map((task, index) => (
                <li key={task.id} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      tagsBgColors2[index % tagsBgColors2.length],
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate text-2xs text-content-secondary">{task.title}</span>
                </li>
              ))}
              {extra > 0 && (
                <li className="font-mono text-2xs text-muted-foreground">
                  {copy.month.moreTasks.replace("{n}", String(extra))}
                </li>
              )}
            </ul>
          )}
        </button>
      </SheetTrigger>

      <SheetContent className="flex flex-col gap-0">
        <SheetHeader>
          <SheetTitle>{copy.month.sheetTitle}</SheetTitle>
          <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {format(day, "EEE · d MMM", { locale: ptBR })}
          </span>
        </SheetHeader>

        <div className="scrollbar-floating min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-content-secondary">
              {copy.month.sheetEmpty}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {groups.map((group) =>
                group.tasks.map((task, index) => (
                  <li key={task.id}>
                    <DayTaskRow task={task} day={day} showTime={index === 0} />
                  </li>
                )),
              )}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Uma armadilha aqui:** o `SheetTrigger asChild` envolve um `<button>`, e `DayTaskRow` (dentro do `SheetContent`) tem seus próprios botões — mas eles vivem num portal do Radix, fora da árvore do trigger, então não há aninhamento inválido. Confirme lendo `ui/sheet.tsx` que `SheetContent` usa `SheetPortal`.

- [ ] **Step 2: Delete the old view**

```bash
git rm apps/web/src/components/calendar-view.tsx
```

Run: `grep -rn "calendar-view\|CalendarView" apps/web/src`
Expected: nada. Se aparecer, migre o consumidor.

- [ ] **Step 3: Gate**

Run: `bun run check`
Expected: exit 0. Warnings devem **cair** de 42 (o arquivo deletado tinha alguns) — anote o número novo, ele vira o teto das próximas tasks.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): view do mes como janela, reusando DayTaskRow na sheet do dia"
```

---

### Task 3: limpeza e verificação

**Files:**
- Modify: `apps/web/src/components/landing/mocks/calendar-app-window.tsx` (correção domingo-primeiro)
- Possivelmente: `apps/web/src/components/dashboard/copy.ts` (chaves órfãs)

- [ ] **Step 1: Fix the landing mock's week order**

`calendar-app-window.tsx:5` diz "segunda-a-domingo, casando com o app" e está errado — o app é domingo-primeiro. Troque `WEEKDAY_LABELS` para `["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]` e ajuste o padding de `MONTH_DAYS`: hoje ele começa com dois `null` para alinhar o dia 1 numa semana que começa na segunda. Recalcule para domingo-primeiro mantendo `TODAY = 14` num dia plausível, e corrija o comentário da linha 5.

Este é um mock decorativo; o critério é a grade parecer um calendário coerente, não bater com um mês real específico.

- [ ] **Step 2: Hunt orphaned copy keys**

O `calendar-view.tsx` foi deletado; veja se alguma chave de `copy.ts` ficou sem consumidor:

```bash
grep -oE "copy\.[a-zA-Z]+\.[a-zA-Z]+" -r apps/web/src | sed 's/.*://' | sort -u > /tmp/used.txt
```

Compare com as chaves definidas em `apps/web/src/components/dashboard/copy.ts`. Remova as que não têm uso. Se `copy.task.options` / `copy.task.completeError` / `copy.task.deleteError` aparecerem como não usadas, **verifique manualmente** antes de remover — elas são usadas em `day-task-row.tsx` e o grep pode escapar dependendo da formatação.

- [ ] **Step 3: Regression greps**

```bash
grep -rnE "surface-(raised|panel|slab|ink)" apps/web/src/components/dashboard apps/web/src/pages/home.tsx
```
Expected: nada.

```bash
grep -rn "accent-primary" apps/web/src/components/dashboard apps/web/src/components/app-header.tsx
```
Expected: cada ocorrência mapeia num dos cinco papéis (ação primária, view ativa, hoje, agora, tarefa aberta). Liste-as no relatório com o papel de cada uma.

- [ ] **Step 4: Gate and build**

```bash
bun run check
bun run build
```
Expected: ambos exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(web): corrige a ordem da semana no mock da landing e limpa copy orfa"
```

---

## Fora de escopo deste plano

- **Fase 4** — sheet de detalhe em modo leitura (bd `Dailify-bie`). Hoje o clique numa tarefa abre a edição direto, tanto no dia quanto no mês.
- **Fase 5** — o interior dos diálogos `NewTask` / `NewTaskVoice` (só os gatilhos foram restilizados).
- **Fase 6** — `/profile` (bd `Dailify-o8u` cobre o toggle que aparece lá indevidamente).
- **Verificação visual** — `/dashboard` é Clerk-gated e o backend local (`localhost:8787`) não roda enquanto a Phase 8 (bd `n0o`) não for feita, então a tela só exibe o estado vazio. O gate visual continua sendo humano.
