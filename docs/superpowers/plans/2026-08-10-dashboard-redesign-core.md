# Dashboard redesign — núcleo (fases 0–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar o `/dashboard` (view do dia) ao vocabulário visual da landing, reusando os componentes que a landing já tem, de modo que quem clica em "Começar — é grátis" chegue na tela que acabou de ver.

**Architecture:** Três camadas, nesta ordem. (1) Fundação pura e testável: tokens de prioridade, o `TaskCard` da landing promovido a componente compartilhado, e três funções puras em `functions.ts` que hoje estão duplicadas ou inexistentes. (2) Shell: o header monolítico se divide em `SiteHeader`/`AppHeader`, e o `/dashboard` passa a declarar sua própria superfície. (3) A view do dia como janela com chrome, gutter de horário e linha do "agora". A view do mês **continua exatamente como está** neste plano — ela é a fase 3, num plano próprio.

**Tech Stack:** React 18 + TypeScript + Vite · Tailwind v4 (tokens em `global.css`) · framer-motion · date-fns (locale `ptBR`) · lucide-react · vitest · bun

## Global Constraints

Estas valem para **toda** task deste plano. Vêm do spec `docs/superpowers/specs/2026-08-10-dashboard-redesign-design.md` e do `CLAUDE.md` do repo.

- **Sem `as`.** Type assertions são warning de lint (`consistent-type-assertions`). `as const` é permitido. Use type guards.
- **Sem hex, sem cor arbitrária em componente.** Só tokens. Cor nova = token em `global.css` + mapeamento em `@theme inline`.
- **Sem `/opacity` em elemento interativo ou superfície.** Cor sólida (bd `k00`). `shadow-[0_0_8px_var(--accent-glow)]` é permitido — o token já carrega a transparência.
- **Escada de superfícies do app:** `surface-page` (shell) → `surface-card` (janelas) → cartão de tarefa **sem fill**, só `border-surface-line`; `surface-hover` no hover. **Nunca** usar `surface-raised`, `surface-panel`, `surface-slab*` ou `surface-ink*` no dashboard.
- **Crimson (`accent-primary`) só em cinco papéis:** ação primária · view ativa · hoje · agora · tarefa aberta. Qualquer sexto uso é bug.
- **Mono para dado de máquina** (`font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground`), sans para texto humano. Texto secundário é `text-content-secondary`, não `text-muted-foreground`.
- **Toda string visível vem de `components/dashboard/copy.ts`** (Task 6), em pt-BR. Nenhuma string literal em JSX.
- **Todo bloco animado lê `useReducedMotion()`** do framer-motion.
- **O número de warnings de lint não pode subir de 43.** `bun run check` roda format + lint + typecheck + os 3 suites.
- **`bun` é o package manager.** Nenhuma dependência nova neste plano.

---

### Task 1: Tokens de prioridade

Hoje `consts/conts.ts` usa cores nomeadas do Tailwind (`text-red-500`, `bg-green-500/10`) — cor crua ao lado de tokens oklch, e com `/opacity`. Fecha o bd `emm`.

**Files:**
- Modify: `apps/web/src/global.css` (bloco de tokens em `:root`, e `@theme inline`)
- Modify: `apps/web/src/consts/conts.ts:1-29`
- Test: `apps/web/src/consts/conts.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: classes `text-priority-0`…`text-priority-4`, `border-priority-0`…`4`, `bg-priority-0`…`4`; os arrays `priorityText`, `priorityTextColor`, `priorityBorderColor`, `priorityBgColor`, `prioritySelectedBgColor` (mesmos nomes de hoje, mesmo índice 0–4)

- [ ] **Step 1: Write the failing test**

Em `apps/web/src/consts/conts.test.ts`, adicione ao final do arquivo (mantenha o `describe("plan ids")` que já existe):

```ts
import {
  priorityText,
  priorityTextColor,
  priorityBorderColor,
  priorityBgColor,
  prioritySelectedBgColor,
} from "./conts";

describe("priority scale", () => {
  const scales = {
    priorityText,
    priorityTextColor,
    priorityBorderColor,
    priorityBgColor,
    prioritySelectedBgColor,
  };

  test("every scale has exactly 5 levels (0-4)", () => {
    for (const [name, scale] of Object.entries(scales)) {
      expect(scale, name).toHaveLength(5);
    }
  });

  test("color scales point at priority tokens, never raw Tailwind colors", () => {
    const colorScales = {
      priorityTextColor,
      priorityBorderColor,
      priorityBgColor,
      prioritySelectedBgColor,
    };
    for (const [name, scale] of Object.entries(colorScales)) {
      scale.forEach((cls, i) => {
        expect(cls, `${name}[${i}]`).toContain(`priority-${i}`);
        expect(cls, `${name}[${i}]`).not.toMatch(/-(red|green|yellow|orange|gray|zinc)-\d/);
      });
    }
  });

  test("no scale uses /opacity", () => {
    for (const [name, scale] of Object.entries(scales)) {
      for (const cls of scale) expect(cls, name).not.toContain("/");
    }
  });
});
```

Adicione o import de `describe, test, expect` só se ainda não estiver no topo — ele já está.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @dailify/web test -- conts`
Expected: FAIL — `priorityTextColor[0]` é `"text-gray-500"`, não contém `priority-0`.

- [ ] **Step 3: Add the tokens to `global.css`**

Em `apps/web/src/global.css`, dentro de `:root`, logo **depois** do bloco `/* semantic status */` (que termina em `--premium-foreground`), insira:

```css
  /* escala de prioridade 0–4 (bd emm) — substitui gray/green/yellow/orange/red crus */
  --priority-0: light-dark(oklch(55.2% 0.014 285.9), oklch(71.2% 0.013 286.1));
  --priority-1: light-dark(oklch(52% 0.15 149.6), oklch(69.6% 0.17 149.6));
  --priority-2: light-dark(oklch(66% 0.14 85), oklch(80% 0.16 85));
  --priority-3: light-dark(oklch(63% 0.18 50), oklch(75% 0.17 55));
  --priority-4: light-dark(oklch(58.6% 0.222 17.6), oklch(70% 0.2 20));
  /* fundo do chip de prioridade: mistura sólida, não /opacity (bd k00) */
  --priority-bg-0: color-mix(in oklch, var(--priority-0) 12%, var(--surface-card));
  --priority-bg-1: color-mix(in oklch, var(--priority-1) 12%, var(--surface-card));
  --priority-bg-2: color-mix(in oklch, var(--priority-2) 12%, var(--surface-card));
  --priority-bg-3: color-mix(in oklch, var(--priority-3) 12%, var(--surface-card));
  --priority-bg-4: color-mix(in oklch, var(--priority-4) 12%, var(--surface-card));
```

E em `@theme inline`, depois do bloco `--color-premium-foreground`, insira:

```css
  --color-priority-0: var(--priority-0);
  --color-priority-1: var(--priority-1);
  --color-priority-2: var(--priority-2);
  --color-priority-3: var(--priority-3);
  --color-priority-4: var(--priority-4);
  --color-priority-bg-0: var(--priority-bg-0);
  --color-priority-bg-1: var(--priority-bg-1);
  --color-priority-bg-2: var(--priority-bg-2);
  --color-priority-bg-3: var(--priority-bg-3);
  --color-priority-bg-4: var(--priority-bg-4);
```

- [ ] **Step 4: Point `conts.ts` at the tokens**

Substitua `apps/web/src/consts/conts.ts:1-29` inteiro por:

```ts
export const priorityText = ["Sem prioridade", "Baixa", "Média", "Alta", "Urgente"];
export const priorityTextColor = [
  "text-priority-0",
  "text-priority-1",
  "text-priority-2",
  "text-priority-3",
  "text-priority-4",
];
export const priorityBorderColor = [
  "border-priority-0",
  "border-priority-1",
  "border-priority-2",
  "border-priority-3",
  "border-priority-4",
];
export const priorityBgColor = [
  "bg-priority-bg-0",
  "bg-priority-bg-1",
  "bg-priority-bg-2",
  "bg-priority-bg-3",
  "bg-priority-bg-4",
];
export const prioritySelectedBgColor = [
  "data-[state=on]:bg-priority-0",
  "data-[state=on]:bg-priority-1",
  "data-[state=on]:bg-priority-2",
  "data-[state=on]:bg-priority-3",
  "data-[state=on]:bg-priority-4",
];
```

Note que `priorityText` também foi traduzido — era `["Not Important", "Low", …]`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --filter @dailify/web test -- conts`
Expected: PASS (4 testes: o de plan ids + os 3 novos)

- [ ] **Step 6: Verify the tokens actually reach the CSS**

Run: `bun run build 2>&1 | tail -5 && grep -c "priority-0" apps/web/dist/assets/*.css`
Expected: build verde e contagem ≥ 1. Se for 0, o `@theme inline` não foi editado ou a classe não é usada em lugar nenhum ainda — nesse caso confira só que `--priority-0` aparece no CSS emitido (`grep "\-\-priority-0" apps/web/dist/assets/*.css`), já que o Tailwind só emite a *utility* quando alguém a usa.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/global.css apps/web/src/consts/conts.ts apps/web/src/consts/conts.test.ts
git commit -m "feat(web): tokeniza a escala de prioridade 0-4 (bd emm)"
```

---

### Task 2: Promover `TaskCard` para componente compartilhado

O `TaskCard` da landing é o cartão de tarefa real do design — com crossfade skeleton→conteúdo e cluster de dots de overflow de tag. Ele sai de `landing/` e ganha as capacidades que o app precisa, **todas opcionais**, para a landing não mudar.

**Files:**
- Move: `apps/web/src/components/landing/task-card.tsx` → `apps/web/src/components/task-card.tsx`
- Modify (imports): `apps/web/src/components/landing/mocks/day-column.tsx:1`, `mocks/voice-result-card.tsx:4`, `mocks/task-detail-sheet.tsx:6`, `mocks/recurrence-app-window.tsx:6`, `scenes/scene-tarefas.tsx:4`, `scenes/scene-recorrencia.tsx:7`

**Interfaces:**
- Consumes: `priorityTextColor` (Task 1)
- Produces: `TaskCard`, `TagBadge`, `TagDots`, e os tipos `TaskCardData` / `TaskCardProps` em `@/components/task-card`:
  ```ts
  export interface TaskCardData { time: string; title: string; duration: string; tags: string[] }
  export interface TaskCardProps extends TaskCardData {
    loading?: boolean; selected?: boolean; completed?: boolean;
    priority?: number; onClick?: () => void; actions?: ReactNode;
  }
  ```

- [ ] **Step 1: Move the file**

```bash
git mv apps/web/src/components/landing/task-card.tsx apps/web/src/components/task-card.tsx
```

- [ ] **Step 2: Fix the six imports**

Em cada arquivo, `"../task-card"` vira `"@/components/task-card"`. São exatamente estes seis — três importam só `TagBadge`:

```
components/landing/mocks/day-column.tsx:1            TaskCard, type TaskCardData
components/landing/mocks/voice-result-card.tsx:4     TaskCard
components/landing/scenes/scene-tarefas.tsx:4        TaskCard, type TaskCardData
components/landing/mocks/task-detail-sheet.tsx:6     TagBadge
components/landing/mocks/recurrence-app-window.tsx:6 TagBadge
components/landing/scenes/scene-recorrencia.tsx:7    TagBadge
```

Confirme que não sobrou nenhum: `grep -rn "from \"../task-card\"\|from \"./landing/task-card\"" apps/web/src` deve não retornar nada.

- [ ] **Step 3: Run typecheck to verify nothing else referenced it**

Run: `bun --filter @dailify/web typecheck`
Expected: PASS. Se falhar, o erro aponta o import que faltou.

- [ ] **Step 4: Commit the move by itself**

Mover e editar no mesmo commit esconde o rename no diff. Commit separado:

```bash
git add -A apps/web/src/components/task-card.tsx apps/web/src/components/landing
git commit -m "refactor(web): move TaskCard de landing/ para components/ (vai ser usado pelo dashboard)"
```

- [ ] **Step 5: Add the app-only props**

Em `apps/web/src/components/task-card.tsx`:

Troque o bloco de imports do topo por:

```tsx
import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Flag, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { priorityTextColor, tagsBgColors2 } from "@/consts/conts";
import { cn } from "@/lib/utils";
```

Troque a declaração de `TaskCardData` (hoje em `:82`) por:

```tsx
export interface TaskCardData {
  time: string;
  title: string;
  duration: string;
  tags: string[];
}

/**
 * O cartão nasceu como mock da landing (só os 4 campos de `TaskCardData`). Tudo abaixo é
 * capacidade do app e é OPCIONAL — a landing continua passando os 4 campos e não muda.
 */
export interface TaskCardProps extends TaskCardData {
  /** Skeleton com crossfade pro conteúdo. */
  loading?: boolean;
  /** Borda crimson — a tarefa cuja sheet está aberta. */
  selected?: boolean;
  /** Concluída neste dia: título riscado + check verde. */
  completed?: boolean;
  /** 0–4; só aparece a partir de 1 (0 = "sem prioridade" não merece ícone). */
  priority?: number;
  /** Abre o detalhe. Vira um overlay clicável — ver nota de acessibilidade no corpo. */
  onClick?: () => void;
  /** Menu (⋮) do app, à direita da duração. Fica FORA do overlay clicável. */
  actions?: ReactNode;
}
```

Troque a assinatura e o corpo de `CardBody` por:

```tsx
/** Corpo do card — mesma estrutura em loading/ready (alturas casam, sem jump no crossfade). */
function CardBody({
  time,
  title,
  tags,
  duration,
  loading,
  selected,
  completed,
  priority,
  onClick,
  actions,
}: TaskCardProps) {
  const shown = tags.slice(0, MAX_TAGS);
  const extra = tags.length - shown.length;
  return (
    <div className="flex items-start gap-3">
      <span className="w-12 shrink-0 pt-2.5 text-right font-mono text-2xs text-muted-foreground">
        {time}
      </span>

      <div
        className={cn(
          "relative min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2.5",
          selected && !loading ? "border-accent-primary" : "border-surface-line",
          onClick && !loading && "transition-colors hover:bg-surface-hover",
        )}
      >
        {/* Overlay clicável em vez de envolver tudo num <button>: `actions` também é um botão, e
            botão dentro de botão é HTML inválido. O overlay dá teclado e foco de graça; `actions`
            fica acima dele no z, então o clique no menu não abre o detalhe. */}
        {onClick && !loading && (
          <button
            type="button"
            onClick={onClick}
            aria-label={title}
            className="absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        )}

        <div className="flex items-center justify-between gap-3">
          {loading ? (
            <span className="skeleton h-3.5 w-32 rounded" />
          ) : (
            <span
              className={cn(
                "truncate text-sm font-medium",
                completed ? "text-muted-foreground line-through" : "text-foreground",
              )}
            >
              {title}
            </span>
          )}

          <div className="pointer-events-none relative z-10 flex shrink-0 items-center gap-1.5">
            {!loading && completed && (
              <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
            )}
            {!loading && priority !== undefined && priority > 0 && (
              <Flag
                className={cn("size-3 shrink-0", priorityTextColor[priority])}
                aria-hidden="true"
              />
            )}
            <DurationBadge value={duration} loading={loading} />
            {!loading && actions && <span className="pointer-events-auto">{actions}</span>}
          </div>
        </div>

        {(shown.length > 0 || extra > 0) && (
          <div className="relative z-10 mt-2 flex items-center gap-1.5 overflow-hidden">
            {shown.map((tag, i) => (
              <TagBadge key={i} label={tag} loading={loading} />
            ))}
            <TagDots extra={extra} startIndex={MAX_TAGS} loading={loading} />
          </div>
        )}
      </div>
    </div>
  );
}
```

E troque a assinatura de `TaskCard` (hoje em `:140`) por:

```tsx
export function TaskCard({ loading, ...data }: TaskCardProps): JSX.Element {
  return (
    <div className="grid">
      <motion.div
        aria-hidden
        className="pointer-events-none col-start-1 row-start-1"
        initial={false}
        animate={{ opacity: loading ? 1 : 0 }}
        transition={{ duration: 0.45, ease: EXPO }}
      >
        <CardBody {...data} loading />
      </motion.div>
      <motion.div
        className="col-start-1 row-start-1"
        initial={false}
        animate={{ opacity: loading ? 0 : 1 }}
        transition={{ duration: 0.45, ease: EXPO }}
      >
        <CardBody {...data} />
      </motion.div>
    </div>
  );
}
```

(O `selected` deixou de ser desestruturado à parte porque agora viaja dentro de `...data`.)

- [ ] **Step 6: Verify the landing still typechecks and renders**

Run: `bun --filter @dailify/web typecheck && bun --filter @dailify/web test`
Expected: PASS, PASS.

Depois, visual: suba `bun --filter @dailify/web dev` e capture a landing —

```bash
chromium --headless --disable-gpu --ignore-certificate-errors \
  --virtual-time-budget=6000 --window-size=1440,2200 \
  --screenshot=/tmp/landing-after-move.png https://localhost:1420/
```

Expected: hero e aba DAY idênticos ao de antes — os cartões de tarefa com gutter de horário, título, badge de duração e tags. Se algum cartão perdeu o layout, o culpado é o `CardBody` reescrito, não o move.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/task-card.tsx
git commit -m "feat(web): TaskCard ganha completed/priority/onClick/actions (opcionais, landing intacta)"
```

---

### Task 3: `groupTasksByTime` — agrupamento por horário, hoje duplicado

O mesmo `reduce` + `sort` está copiado literalmente em `daily-tasks.tsx:55-72` e `calendar-view.tsx:138-155`. Vira uma função pura testada.

**Files:**
- Modify: `apps/web/src/functions/functions.ts` (append)
- Test: `apps/web/src/functions/functions.test.ts` (append)

**Interfaces:**
- Consumes: `getTime` (já existe em `functions.ts:17`)
- Produces: `groupTasksByTime(tasks: ReadonlyArray<TaskProps>): TimeGroup[]` e `export interface TimeGroup { time: string; tasks: TaskProps[] }`

- [ ] **Step 1: Write the failing test**

Append em `apps/web/src/functions/functions.test.ts` (o helper `makeTask` já existe no topo do arquivo; adicione `groupTasksByTime` ao import de `./functions`):

```ts
describe("groupTasksByTime", () => {
  test("groups tasks that share the same HH:MM", () => {
    const a = makeTask({ id: "a", date: new Date(2026, 7, 10, 9, 0).getTime() });
    const b = makeTask({ id: "b", date: new Date(2026, 7, 10, 9, 0).getTime() });
    const groups = groupTasksByTime([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].time).toBe("09:00");
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  test("orders groups chronologically regardless of input order", () => {
    const late = makeTask({ id: "late", date: new Date(2026, 7, 10, 14, 30).getTime() });
    const early = makeTask({ id: "early", date: new Date(2026, 7, 10, 9, 5).getTime() });
    const mid = makeTask({ id: "mid", date: new Date(2026, 7, 10, 11, 0).getTime() });
    expect(groupTasksByTime([late, early, mid]).map((g) => g.time)).toEqual([
      "09:05",
      "11:00",
      "14:30",
    ]);
  });

  test("sorts by minutes too, not just by hour", () => {
    const later = makeTask({ id: "later", date: new Date(2026, 7, 10, 9, 45).getTime() });
    const sooner = makeTask({ id: "sooner", date: new Date(2026, 7, 10, 9, 5).getTime() });
    expect(groupTasksByTime([later, sooner]).map((g) => g.time)).toEqual(["09:05", "09:45"]);
  });

  test("returns an empty array for no tasks", () => {
    expect(groupTasksByTime([])).toEqual([]);
  });

  test("does not mutate the input array", () => {
    const a = makeTask({ id: "a", date: new Date(2026, 7, 10, 14, 0).getTime() });
    const b = makeTask({ id: "b", date: new Date(2026, 7, 10, 8, 0).getTime() });
    const input = [a, b];
    groupTasksByTime(input);
    expect(input.map((t) => t.id)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @dailify/web test -- functions`
Expected: FAIL — `groupTasksByTime is not a function` / erro de import.

- [ ] **Step 3: Write the implementation**

Append em `apps/web/src/functions/functions.ts`:

```ts
export interface TimeGroup {
  /** "HH:MM" zero-padded, o mesmo formato de `getTime(date, "HH:MM")`. */
  time: string;
  tasks: TaskProps[];
}

/**
 * Agrupa as tarefas do dia por horário e ordena os grupos cronologicamente. Extraído de
 * `daily-tasks.tsx` e `calendar-view.tsx`, que tinham este mesmo reduce+sort copiado.
 * Não muta a entrada.
 */
export function groupTasksByTime(tasks: ReadonlyArray<TaskProps>): TimeGroup[] {
  const byTime = new Map<string, TaskProps[]>();
  for (const task of tasks) {
    const time = getTime(task.date, "HH:MM");
    const bucket = byTime.get(time);
    if (bucket) bucket.push(task);
    else byTime.set(time, [task]);
  }
  return [...byTime.entries()]
    .map(([time, group]) => ({ time, tasks: group }))
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

/** "HH:MM" → minutos desde a meia-noite. Interno; `getTime` já garante o zero-padding. */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @dailify/web test -- functions`
Expected: PASS (5 testes novos, mais os que já existiam)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/functions/functions.ts apps/web/src/functions/functions.test.ts
git commit -m "feat(web): groupTasksByTime como funcao pura (era duplicada em 2 telas)"
```

---

### Task 4: `taskToCardData` — o adaptador `TaskProps` → `TaskCardData`

**Files:**
- Modify: `apps/web/src/functions/functions.ts` (append)
- Test: `apps/web/src/functions/functions.test.ts` (append)

**Interfaces:**
- Consumes: `TaskCardData` (Task 2, type-only), `getTime` e `getCompletionDate` (já existem)
- Produces: `taskToCardData(task: TaskProps, day: Date): TaskCardData & { completed: boolean; priority: number }`

- [ ] **Step 1: Write the failing test**

Append em `apps/web/src/functions/functions.test.ts` (adicione `taskToCardData` ao import de `./functions`):

```ts
describe("taskToCardData", () => {
  const day = new Date(2026, 7, 10);

  test("maps the card fields off the task", () => {
    const task = makeTask({
      title: "Revisar PRs",
      duration: "45min",
      priority: 3,
      tags: ["dev", "review"],
      date: new Date(2026, 7, 10, 8, 30).getTime(),
    });
    expect(taskToCardData(task, day)).toEqual({
      time: "08:30",
      title: "Revisar PRs",
      duration: "45min",
      tags: ["dev", "review"],
      priority: 3,
      completed: false,
    });
  });

  test("missing tags become an empty array, never undefined", () => {
    const task = makeTask({ tags: undefined });
    expect(taskToCardData(task, day).tags).toEqual([]);
  });

  test("completed is true only when the task was completed on THAT day", () => {
    const onDay = makeTask({ completed: [new Date(2026, 7, 10, 18, 0).getTime()] });
    const otherDay = makeTask({ completed: [new Date(2026, 7, 9, 18, 0).getTime()] });
    expect(taskToCardData(onDay, day).completed).toBe(true);
    expect(taskToCardData(otherDay, day).completed).toBe(false);
  });

  test("completed is false (never undefined) for an empty completed list", () => {
    expect(taskToCardData(makeTask({ completed: [] }), day).completed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @dailify/web test -- functions`
Expected: FAIL — `taskToCardData is not a function`.

- [ ] **Step 3: Write the implementation**

No topo de `apps/web/src/functions/functions.ts`, junto dos outros imports, adicione o import **type-only** (apagado no build, então nenhum React entra na cadeia de runtime deste arquivo puro):

```ts
import type { TaskCardData } from "@/components/task-card";
```

E append no fim do arquivo:

```ts
/**
 * Converte a tarefa do domínio (epoch-ms, priority numérico, completed[]) no formato de strings que
 * o `TaskCard` consome. `day` é o dia em que o cartão está sendo renderizado — é ele que decide se a
 * tarefa conta como concluída (uma recorrente é concluída por ocorrência, não de uma vez).
 */
export function taskToCardData(
  task: TaskProps,
  day: Date,
): TaskCardData & { completed: boolean; priority: number } {
  return {
    time: getTime(task.date, "HH:MM"),
    title: task.title,
    duration: task.duration,
    tags: task.tags ?? [],
    priority: task.priority,
    completed: getCompletionDate(task, day) === true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @dailify/web test -- functions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/functions/functions.ts apps/web/src/functions/functions.test.ts
git commit -m "feat(web): taskToCardData, o adaptador TaskProps -> TaskCardData"
```

---

### Task 5: `nowLineIndex` + `useNow` — onde a linha do "agora" entra

A linha do "agora" (`day-column.tsx:18`) é decorativa no mock; na tela real ela precisa cair no lugar certo da lista, e continuar certa com o app aberto o dia todo.

**Files:**
- Modify: `apps/web/src/functions/functions.ts` (append)
- Test: `apps/web/src/functions/functions.test.ts` (append)
- Create: `apps/web/src/hooks/useNow.ts`

**Interfaces:**
- Consumes: `TimeGroup` (Task 3)
- Produces: `nowLineIndex(groups: ReadonlyArray<Pick<TimeGroup, "time">>, now: Date): number` — índice do grupo **antes do qual** a linha entra; `groups.length` significa "depois de todos". E `useNow(intervalMs: number): Date`.

- [ ] **Step 1: Write the failing test**

Append em `apps/web/src/functions/functions.test.ts` (adicione `nowLineIndex` ao import):

```ts
describe("nowLineIndex", () => {
  const at = (h: number, m: number) => new Date(2026, 7, 10, h, m);
  const groups = [{ time: "09:00" }, { time: "11:00" }, { time: "14:30" }];

  test("0 when now is before every group — the line sits on top", () => {
    expect(nowLineIndex(groups, at(7, 0))).toBe(0);
  });

  test("splits the list when now falls between two groups", () => {
    expect(nowLineIndex(groups, at(10, 0))).toBe(1);
    expect(nowLineIndex(groups, at(12, 0))).toBe(2);
  });

  test("groups.length when now is past every group — the line sits at the bottom", () => {
    expect(nowLineIndex(groups, at(18, 0))).toBe(3);
  });

  test("a group starting exactly now is still ahead of the line", () => {
    expect(nowLineIndex(groups, at(11, 0))).toBe(1);
  });

  test("0 for an empty list", () => {
    expect(nowLineIndex([], at(12, 0))).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @dailify/web test -- functions`
Expected: FAIL — `nowLineIndex is not a function`.

- [ ] **Step 3: Write the implementation**

Append em `apps/web/src/functions/functions.ts`:

```ts
/**
 * Índice do grupo ANTES do qual a linha do "agora" é inserida; `groups.length` = depois de todos.
 * Um grupo que começa exatamente agora fica à frente da linha (a tarefa está começando, não passou).
 * Os extremos são deliberados: a linha aparece no topo antes do primeiro compromisso e no rodapé
 * depois do último, que são justamente os dois momentos do dia em que ela mais informa.
 */
export function nowLineIndex(
  groups: ReadonlyArray<Pick<TimeGroup, "time">>,
  now: Date,
): number {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const index = groups.findIndex((group) => timeToMinutes(group.time) >= nowMinutes);
  return index === -1 ? groups.length : index;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @dailify/web test -- functions`
Expected: PASS

- [ ] **Step 5: Write `useNow`**

Create `apps/web/src/hooks/useNow.ts`:

```ts
import { useEffect, useState } from "react";

/**
 * Relógio que re-renderiza a cada `intervalMs`. Existe pela linha do "agora": um app de agenda fica
 * aberto o dia inteiro, e sem o tick a linha congela no horário em que a página abriu.
 *
 * Não é animação — o tick NÃO deve ser desligado sob `prefers-reduced-motion`: a posição da linha
 * é dado, não movimento.
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
```

- [ ] **Step 6: Run the full gate**

Run: `bun --filter @dailify/web typecheck && bun --filter @dailify/web test`
Expected: PASS, PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/functions/functions.ts apps/web/src/functions/functions.test.ts apps/web/src/hooks/useNow.ts
git commit -m "feat(web): nowLineIndex + useNow para a linha do agora"
```

---

### Task 6: `copy.ts` do dashboard

Espelha `landing/copy.ts`: dicionário plano, pt-BR, sem concatenação, pronto para um locale futuro (bd `17s`).

**Files:**
- Create: `apps/web/src/components/dashboard/copy.ts`
- Test: `apps/web/src/components/dashboard/copy.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `copy` (default export nomeado `copy`) e `type DashboardCopy` em `@/components/dashboard/copy`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/dashboard/copy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { copy } from "./copy";

describe("dashboard copy", () => {
  it("tem todas as seções e nenhuma string vazia", () => {
    for (const section of ["header", "day", "aside", "task"] as const) {
      expect(copy[section]).toBeTruthy();
    }
    expect(JSON.stringify(copy)).not.toMatch(/""/);
  });

  it("está em pt-BR — nenhuma das strings em inglês que o dashboard tinha", () => {
    const flat = JSON.stringify(copy).toLowerCase();
    for (const english of ["today's tasks", "new task", "upcoming task", "edit task"]) {
      expect(flat).not.toContain(english);
    }
  });

  it("não hard-coda limite de plano (vem de PLAN_PERMISSIONS)", () => {
    expect(JSON.stringify(copy)).not.toMatch(/\d+ tarefas/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --filter @dailify/web test -- dashboard/copy`
Expected: FAIL — não resolve `./copy`.

- [ ] **Step 3: Write the copy dictionary**

Create `apps/web/src/components/dashboard/copy.ts`:

```ts
/**
 * Dicionário de copy pt-BR do dashboard.
 *
 * Fonte única de verdade pra todo texto visível do app autenticado, espelhando o
 * `landing/copy.ts`. Estruturado plano (sem concatenação) pra permitir um locale `en` futuro
 * (bd Dailify-17s) — cada chave é uma string final pronta pra renderizar.
 *
 * Não hard-codar números de plano aqui: limites vêm de `@dailify/shared` `PLAN_PERMISSIONS`.
 */
export const copy = {
  header: {
    logoAlt: "Dailify",
    viewDay: "Hoje",
    viewMonth: "Mês",
    upgrade: "Assinar",
    profile: "Perfil",
    settings: "Configurações",
    signOut: "Sair",
    signIn: "Entrar",
    dashboard: "Dashboard",
  },

  day: {
    today: "Hoje",
    now: "agora",
    emptyTitle: "SEM TAREFAS PARA ESTE DIA",
    emptyHint: "Crie a primeira e ela aparece aqui, encaixada no horário.",
    newTask: "Nova tarefa",
    voiceTask: "Criar por voz",
  },

  aside: {
    nextTaskLabel: "PRÓXIMA TAREFA",
    noNextTask: "Nada pela frente neste mês.",
    calendarLabel: "CALENDÁRIO",
  },

  task: {
    complete: "Concluir",
    edit: "Editar",
    delete: "Excluir",
    options: "Opções da tarefa",
    completed: "Concluída",
    completeError: "Não foi possível concluir a tarefa",
    deleteError: "Não foi possível excluir a tarefa",
  },
} as const;

export type DashboardCopy = typeof copy;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun --filter @dailify/web test -- dashboard/copy`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/copy.ts apps/web/src/components/dashboard/copy.test.ts
git commit -m "feat(web): copy.ts pt-BR do dashboard, espelhando o da landing"
```

---

### Task 7: `Brand`, `SiteHeader`, `AppHeader`

`header.tsx:18` faz `const path = window.location.pathname` e ramifica em três lugares — não reage a navegação client-side do react-router. A bifurcação vira dois componentes.

**Files:**
- Create: `apps/web/src/components/brand.tsx`
- Create: `apps/web/src/components/site-header.tsx`
- Create: `apps/web/src/components/app-header.tsx`
- Modify: `apps/web/src/pages/landingPage.tsx:1,17` · `pages/terms.tsx:3,14` · `pages/privacy.tsx:3,14` · `pages/premium.tsx:22,120` → `SiteHeader`
- Modify: `apps/web/src/pages/profile.tsx:4,25` → `AppHeader`

São **seis** páginas usando o header hoje, não três: além da landing e do dashboard, também
`terms`, `privacy`, `premium` (públicas → `SiteHeader`) e `profile` (autenticada → `AppHeader`).

O `header.tsx` antigo **não** é apagado aqui — ele ainda serve o `home.tsx`, que só é reescrito na
Task 8. Apagá-lo agora deixaria este commit com typecheck vermelho e estragaria o `git bisect`.

**Interfaces:**
- Consumes: `copy` (Task 6), `useDailify` (`isCalendar`/`setIsCalendar`)
- Produces: `<Brand to={string} />`, `<SiteHeader className?={string} />`, `<AppHeader className?={string} />`

- [ ] **Step 1: Confirm every consumer of the old header**

Run: `grep -rn "components/header\|<Header" apps/web/src --include="*.tsx"`
Expected: seis páginas — `landingPage`, `terms`, `privacy`, `premium`, `profile`, `home`. Se aparecer alguma outra, ela entra na migração do Step 5 pela mesma regra: pública → `SiteHeader`, autenticada → `AppHeader`. `home.tsx` é o único que fica para a Task 8.

- [ ] **Step 2: Write `Brand`**

Create `apps/web/src/components/brand.tsx`:

```tsx
import { Link } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";

/**
 * Logo + wordmark, compartilhado pelo SiteHeader e pelo AppHeader. `to` difere: na landing aponta
 * pra "/", no app pro "/dashboard".
 *
 * O `src` é absoluto de propósito — o header antigo usava "./dailify_logo_2.png", que resolve
 * relativo à rota atual e quebra em qualquer path aninhado.
 */
export function Brand({ to }: { to: string }): JSX.Element {
  return (
    <Link to={to} className="inline-flex items-center gap-2">
      <img
        src="/dailify_logo_2.png"
        alt={copy.header.logoAlt}
        className="size-7 shrink-0 object-contain invert dark:invert-0"
      />
      <span className="text-lg font-semibold tracking-[-0.01em] text-foreground">Dailify</span>
    </Link>
  );
}
```

- [ ] **Step 3: Write `SiteHeader` (landing)**

Create `apps/web/src/components/site-header.tsx`:

```tsx
import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

import { Brand } from "@/components/brand";
import { copy } from "@/components/dashboard/copy";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Header público da landing. Superfície sólida (o antigo era `bg-surface-header/70 backdrop-blur`,
 * contra a regra de cores sólidas do bd k00).
 */
export function SiteHeader({ className }: { className?: string }): JSX.Element {
  const { user } = useUser();

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex w-full items-center justify-between border-b border-surface-line bg-surface-page py-4",
        className,
      )}
    >
      <Brand to="/" />

      <div className="inline-flex items-center gap-3">
        <ModeToggle />
        <Button asChild className="rounded-full">
          <Link to={user ? "/dashboard" : "/login"}>
            {user ? copy.header.dashboard : copy.header.signIn}
          </Link>
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Write `AppHeader` (dashboard/profile)**

Create `apps/web/src/components/app-header.tsx`:

```tsx
import { useAuth, useUser } from "@clerk/clerk-react";
import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Brand } from "@/components/brand";
import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PLAN_ID } from "@/consts/conts";
import { cn } from "@/lib/utils";

/**
 * Header do app autenticado. Carrega o toggle Hoje/Mês — que antes era um botão de ícone sem rótulo
 * solto no meio do conteúdo (`select-day.tsx`). As pills seguem o toggle Mensal/Anual do pricing:
 * a ativa é crimson sólida (papel "view ativa"), a inativa é texto muted.
 */
function ViewToggle(): JSX.Element {
  const { isCalendar, setIsCalendar } = useDailify();
  const views = [
    { key: "day", label: copy.header.viewDay, active: !isCalendar },
    { key: "month", label: copy.header.viewMonth, active: isCalendar },
  ] as const;

  return (
    <div
      role="group"
      aria-label={`${copy.header.viewDay} / ${copy.header.viewMonth}`}
      className="inline-flex items-center gap-1 rounded-full border border-surface-line bg-surface-card p-1"
    >
      {views.map((view) => (
        <button
          key={view.key}
          type="button"
          aria-pressed={view.active}
          onClick={() => setIsCalendar(view.key === "month")}
          className={cn(
            "rounded-full px-4 py-1.5 font-mono text-2xs uppercase tracking-[0.04em] transition-colors",
            view.active
              ? "bg-accent-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

export function AppHeader({ className }: { className?: string }): JSX.Element {
  const { signOut } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const isFree = user?.publicMetadata?.plan === PLAN_ID.free;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex w-full items-center justify-between gap-4 border-b border-surface-line bg-surface-page py-4",
        className,
      )}
    >
      <Brand to="/dashboard" />

      <ViewToggle />

      <div className="inline-flex items-center gap-3">
        <ModeToggle />

        {isFree && (
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/premium">{copy.header.upgrade}</Link>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="size-9 cursor-pointer">
              <AvatarImage src={user?.imageUrl} alt="" />
              <AvatarFallback>
                {user?.firstName?.slice(0, 1)}
                {user?.lastName?.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
              <UserIcon />
              <span>{copy.header.profile}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => e.preventDefault()} className="cursor-pointer">
              <SettingsIcon />
              <span>{copy.header.settings}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
              <LogOutIcon />
              <span>{copy.header.signOut}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

**Nota sobre `ViewToggle` no `/profile`:** ele lê `useDailify`, que existe em toda a árvore (o provider é global em `main.tsx`), então não quebra — mas trocar de view no perfil não leva a lugar nenhum. Deixe assim nesta task; a Task 9 do plano seguinte (fase 6, profile) decide se o toggle vira prop opcional. Registre isso no commit.

- [ ] **Step 5: Point the five non-dashboard pages at the new headers**

Em cada uma, troque só o import e a tag — **preservando o `className` que já estava lá.** Três delas
usam `px-[clamp(1rem,5vw,24rem)]`; trocar isso por `px-gutter` mudaria o layout de páginas que este
plano declara fora de escopo, então fica como está.

| Arquivo | Import novo | Tag |
| --- | --- | --- |
| `pages/landingPage.tsx:1,17` | `import { SiteHeader } from "@/components/site-header";` | `<SiteHeader className="px-gutter" />` |
| `pages/terms.tsx:3,14` | idem | `<SiteHeader className="px-[clamp(1rem,5vw,24rem)]" />` |
| `pages/privacy.tsx:3,14` | idem | `<SiteHeader className="px-[clamp(1rem,5vw,24rem)]" />` |
| `pages/premium.tsx:22,120` | idem | `<SiteHeader className="px-[clamp(1rem,5vw,24rem)]" />` |
| `pages/profile.tsx:4,25` | `import { AppHeader } from "@/components/app-header";` | `<AppHeader />` (não tinha className) |

O import antigo é `default` (`import Header from …`); os novos são **nomeados** (`import { … }`) —
esquecer as chaves dá um erro de typecheck confuso ("has no default export").

- [ ] **Step 6: Typecheck — deve estar verde**

Run: `bun --filter @dailify/web typecheck && bun --filter @dailify/web test`
Expected: PASS, PASS. `home.tsx` continua importando o `header.tsx` antigo, que continua existindo — de propósito.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/brand.tsx apps/web/src/components/site-header.tsx \
        apps/web/src/components/app-header.tsx apps/web/src/pages
git commit -m "refactor(web): SiteHeader + AppHeader ao lado do header antigo (mata o window.location.pathname)"
```

---

### Task 8: Shell do `/dashboard`

`home.tsx` passa a declarar a superfície do app e a hospedar o layout dia+aside. `select-day.tsx` deixa de existir: o toggle foi pro `AppHeader` (Task 7) e o resto vai pro aside (Task 10).

**Files:**
- Modify: `apps/web/src/pages/home.tsx` (arquivo inteiro)
- Delete: `apps/web/src/components/select-day.tsx`
- Delete: `apps/web/src/components/header.tsx` (último consumidor era o `home.tsx`)

**Interfaces:**
- Consumes: `AppHeader` (Task 7), `useDailify`
- Produces: nada para tasks seguintes além de montar `<DayView />` e `<DayAside />`

- [ ] **Step 1: Rewrite `home.tsx`**

Substitua `apps/web/src/pages/home.tsx` inteiro por:

```tsx
import { AppHeader } from "@/components/app-header";
import { CalendarView } from "@/components/calendar-view";
import { useDailify } from "@/components/dailifyContext";
import { DayAside } from "@/components/dashboard/day-aside";
import { DayView } from "@/components/dashboard/day-view";

/**
 * O shell do app. Declara `bg-surface-page` explicitamente: o `body` é `bg-canvas`
 * (`global.css:323`), que no dark é 6,5 pontos de L mais claro e tingido de azul — a landing escapa
 * pelo mesmo motivo, declarando a superfície no seu `<main>`.
 *
 * A view do mês (`CalendarView`) ainda é a antiga; ela é a fase 3, num plano próprio.
 */
export default function Home() {
  const { isCalendar } = useDailify();

  return (
    <main className="flex min-h-dvh flex-col bg-surface-page text-foreground" id="main">
      <AppHeader className="px-gutter" />

      <div className="px-gutter pb-10 pt-6">
        {isCalendar ? (
          <CalendarView />
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_20rem]">
            <DayView />
            <DayAside />
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Delete `select-day.tsx` and the old header**

```bash
git rm apps/web/src/components/select-day.tsx apps/web/src/components/header.tsx
```

Run: `grep -rn "select-day\|SelectDay\|components/header" apps/web/src`
Expected: nenhum resultado. Se algo aparecer, é um consumidor a migrar — provavelmente uma página que o grep da Task 7 Step 1 não pegou.

- [ ] **Step 3: Verify the only remaining errors are the two components not written yet**

Run: `bun --filter @dailify/web typecheck`
Expected: FAIL com exatamente dois erros — `@/components/dashboard/day-view` e `@/components/dashboard/day-aside` não existem. São as Tasks 9 e 10.

- [ ] **Step 4: Do NOT commit yet**

Este é o único ponto do plano em que a árvore fica quebrada de propósito. Siga direto para a Task 9; o commit vem no fim da Task 10, cobrindo shell + dia + aside juntos.

---

### Task 9: `DayView` — a janela do dia

**Files:**
- Create: `apps/web/src/components/dashboard/day-view.tsx`

**Interfaces:**
- Consumes: `TaskCard` (Task 2), `groupTasksByTime` (Task 3), `taskToCardData` (Task 4), `nowLineIndex` + `useNow` (Task 5), `copy` (Task 6), `getTasksForDay` (existente), `useDailify`
- Produces: `<DayView />`

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/dashboard/day-view.tsx`:

```tsx
import { isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Fragment } from "react";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { TaskCard } from "@/components/task-card";
import {
  getTasksForDay,
  groupTasksByTime,
  nowLineIndex,
  taskToCardData,
  type TimeGroup,
} from "@/functions/functions";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";

const EXPO = [0.16, 1, 0.3, 1] as const; // ease-out-expo, espelha o token do global.css
const SKELETON_ROWS = 3;

/** Linha do "agora": rótulo mono no gutter + régua crimson com glow. Só existe no dia de hoje. */
function NowLine(): JSX.Element {
  return (
    <div className="flex items-center gap-3 py-0.5" aria-hidden="true">
      <span className="w-12 shrink-0 text-right font-mono text-2xs text-accent-primary">
        {copy.day.now}
      </span>
      <span className="h-px flex-1 bg-accent-primary shadow-[0_0_10px_var(--accent-glow)]" />
    </div>
  );
}

/**
 * Um grupo de horário. O rótulo aparece só no PRIMEIRO cartão do grupo — os seguintes recebem
 * `time: ""` e ficam com o gutter vazio. É isso que produz a leitura de coluna do tempo; repetir
 * "08:30" três vezes seria ruído.
 */
function TimeGroupRows({
  group,
  day,
  variants,
}: {
  group: TimeGroup;
  day: Date;
  variants: Variants;
}): JSX.Element {
  return (
    <>
      {group.tasks.map((task, index) => {
        const data = taskToCardData(task, day);
        return (
          <motion.li key={task.id} variants={variants}>
            <TaskCard {...data} time={index === 0 ? data.time : ""} />
          </motion.li>
        );
      })}
    </>
  );
}

/**
 * A view do dia — a janela que a landing vende (`landing/mocks/day-app-window.tsx`): chrome com o
 * estado do dia, e uma coluna de tarefas com gutter de horário à esquerda.
 *
 * Estados: carregando (skeletons do próprio TaskCard), vazio, e a lista.
 */
export function DayView(): JSX.Element {
  const { tasks, selectedDay, isLoading } = useDailify();
  const reduce = useReducedMotion();
  const now = useNow(60_000);

  const isCurrentDay = isToday(selectedDay);
  const groups = groupTasksByTime(tasks ? getTasksForDay(tasks, selectedDay) : []);
  const lineAt = isCurrentDay ? nowLineIndex(groups, now) : -1;

  const listVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.06 } },
  };
  const rowVariants: Variants = {
    hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 8 },
    visible: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.35, ease: EXPO } },
  };

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-surface-line bg-surface-card shadow-panel">
      <header className="flex items-center justify-between border-b border-surface-line px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "size-2 rounded-full",
              isCurrentDay
                ? "bg-accent-primary shadow-[0_0_8px_var(--accent-glow)]"
                : "bg-muted-foreground",
            )}
            aria-hidden="true"
          />
          <span className="text-sm font-medium text-foreground">
            {isCurrentDay ? copy.day.today : format(selectedDay, "EEEE", { locale: ptBR })}
          </span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {format(selectedDay, "EEE · d MMM", { locale: ptBR })}
        </span>
      </header>

      <div className="min-h-0 flex-1 p-6">
        {isLoading ? (
          <ul className="flex flex-col gap-3">
            {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
              <li key={i}>
                <TaskCard loading time="" title="" duration="" tags={["", ""]} />
              </li>
            ))}
          </ul>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <p className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
              {copy.day.emptyTitle}
            </p>
            <p className="max-w-xs text-sm text-content-secondary">{copy.day.emptyHint}</p>
          </div>
        ) : (
          <motion.ul
            className="flex flex-col gap-3"
            variants={listVariants}
            initial={reduce ? "visible" : "hidden"}
            animate="visible"
          >
            {groups.map((group, index) => (
              <Fragment key={group.time}>
                {index === lineAt && <NowLine />}
                <TimeGroupRows group={group} day={selectedDay} variants={rowVariants} />
              </Fragment>
            ))}
            {lineAt === groups.length && <NowLine />}
          </motion.ul>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Sanity-check the skeleton branch**

O skeleton passa `tags={["", ""]}` de propósito: o `CardBody` só renderiza a fileira de tags quando `shown.length > 0`, então sem tags o skeleton ficaria mais baixo que o cartão real e a lista pularia ao resolver.

As strings vazias nunca chegam à tela — a primeira linha de `TagBadge` é `if (loading) return <span className="skeleton …" />`, antes de qualquer uso de `label` (verificado). Se alguém inverter essa ordem no futuro, o sintoma são dois badges vazios durante o load.

- [ ] **Step 3: Typecheck (o erro do aside deve ser o único restante)**

Run: `bun --filter @dailify/web typecheck`
Expected: FAIL com um erro só — `@/components/dashboard/day-aside`.

---

### Task 10: `DayAside` — mini-calendário, próxima tarefa, ações

`ui/calendar2.tsx` é um componente do app (lê `useDailify`), não um primitivo shadcn — o `ui/CLAUDE.md` diz explicitamente que app-specific components ficam um nível acima. Ele se muda junto.

**Files:**
- Move: `apps/web/src/components/ui/calendar2.tsx` → `apps/web/src/components/dashboard/mini-calendar.tsx`
- Create: `apps/web/src/components/dashboard/day-aside.tsx`
- Modify (imports de `Calendar2`): descobrir com grep no Step 1

**Interfaces:**
- Consumes: `copy` (Task 6), `getNextTask` (existente), `useDailify`, `NewTask` / `NewTaskVoice` (existentes, sem alteração de API)
- Produces: `<DayAside />`, `<MiniCalendar />`

- [ ] **Step 1: Find and move `Calendar2`**

Run: `grep -rn "calendar2\|Calendar2" apps/web/src`
Expected: a definição + os consumidores. Depois da Task 8, `select-day.tsx` não existe mais, então deve sobrar pouco — anote o que aparecer.

```bash
git mv apps/web/src/components/ui/calendar2.tsx apps/web/src/components/dashboard/mini-calendar.tsx
```

Renomeie o componente de `Calendar2` para `MiniCalendar`, troque o `export default` por `export function MiniCalendar`, e corrija o import interno `from "../dailifyContext"` → `from "@/components/dailifyContext"` e `from "./button"` → `from "@/components/ui/button"`. Atualize os consumidores que o grep achou.

- [ ] **Step 2: Restyle `MiniCalendar`**

Substitua o `return` de `MiniCalendar` por:

```tsx
  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousMonth}
          aria-label="Mês anterior"
          className="size-7 rounded-full text-muted-foreground hover:bg-surface-hover"
        >
          <ChevronLeftIcon />
        </Button>

        <button
          type="button"
          onClick={goToToday}
          className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {format(selectedDay, "MMMM yyyy", { locale: ptBR })}
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextMonth}
          aria-label="Próximo mês"
          className="size-7 rounded-full text-muted-foreground hover:bg-surface-hover"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <ul className="grid w-full grid-cols-7 justify-items-center gap-1">
          {weekDays.map((day, index) => (
            <li
              key={index}
              className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
            >
              {day.slice(0, 1)}
            </li>
          ))}
        </ul>

        <ul className="grid grid-cols-7 justify-items-center gap-1">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = isSameMonth(day, selectedDay);
            const isCurrentDay = isToday(day);
            const isSelectedDay = isSameDay(day, selectedDay);

            return (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-mono text-xs transition-colors",
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                    isCurrentDay && "bg-accent-primary text-primary-foreground",
                    !isCurrentDay && isSelectedDay && "border border-accent-primary",
                    !isCurrentDay && !isSelectedDay && "hover:bg-surface-hover",
                  )}
                >
                  {format(day, "d")}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
```

Adicione ao topo do arquivo os imports que passaram a ser usados: `ptBR` de `date-fns/locale` e `cn` de `@/lib/utils`. O `div` externo perdeu `bg-background rounded-md p-5 border` de propósito — quem dá a superfície agora é o cartão do aside.

**Atenção, comportamento preservado:** `goToPreviousMonth`/`goToNextMonth` chamam `setSelectedDay(subMonths(...))`, ou seja trocar de mês troca o dia selecionado — e o `protected-route` refetcha quando o mês muda. Não mexa nisso aqui.

- [ ] **Step 3: Write `DayAside`**

Create `apps/web/src/components/dashboard/day-aside.tsx`:

```tsx
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import NewTask from "@/components/new-task";
import NewTaskVoice from "@/components/new-task-voice";
import { getNextTask } from "@/functions/functions";

/** Bloco do aside: cartão `surface-card` com hairline, o degrau acima do shell. */
function AsideCard({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-2xl border border-surface-line bg-surface-card p-5">{children}</div>
  );
}

/**
 * Coluna direita da view do dia: navegação por data, o que vem a seguir, e as ações de criação.
 * Substitui o `select-day.tsx`, que empilhava calendário, dois botões quadrados e um card
 * "Upcoming Task" numa grid de duas linhas.
 *
 * "Próxima tarefa" olha o MÊS inteiro (`currentMonthTasks`), não o dia selecionado — é o que dá
 * utilidade ao bloco justamente quando o dia aberto está vazio.
 */
export function DayAside(): JSX.Element {
  const { currentMonthTasks } = useDailify();
  const nextTask = currentMonthTasks ? getNextTask(currentMonthTasks) : undefined;

  return (
    <aside className="flex flex-col gap-4">
      <AsideCard>
        <MiniCalendar />
      </AsideCard>

      <AsideCard>
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {copy.aside.nextTaskLabel}
          </h2>

          {nextTask ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">{nextTask.title}</span>
              <span className="font-mono text-2xs text-muted-foreground">
                {format(new Date(nextTask.date), "EEE · d MMM · HH:mm", { locale: ptBR })}
              </span>
            </div>
          ) : (
            <p className="text-sm text-content-secondary">{copy.aside.noNextTask}</p>
          )}
        </div>
      </AsideCard>

      <div className="flex items-center gap-2">
        <NewTask className="h-10 w-full rounded-full bg-accent-primary text-primary-foreground hover:bg-accent-hover" />
        <NewTaskVoice />
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Check what `NewTask` and `NewTaskVoice` actually render as triggers**

`NewTask` recebe `className: string` (obrigatório) e o aplica num `<Button size="icon">` — com `size="icon"` a largura é fixa em `size-9` e o `w-full` do className pode não vencer. Abra `apps/web/src/components/new-task.tsx:132` e confirme. Se o botão não esticar, troque `size={"icon"}` por `size={"default"}` **nesse arquivo** e adicione o rótulo `{copy.day.newTask}` ao lado do `<PlusIcon />`, que é o que o design pede — o botão de ação primária tem rótulo, não é só um `+`.

`NewTaskVoice` (`new-task-voice.tsx:46`) tem o className hardcoded no próprio componente (`bg-foreground text-background hover:bg-foreground/90`) e não aceita prop. Troque-o por `size-10 shrink-0 rounded-full border border-surface-line bg-surface-card text-foreground hover:bg-surface-hover` — ele é ação secundária, não pode competir com o crimson. O `/90` sai junto (bd `k00`).

- [ ] **Step 5: Typecheck and test**

Run: `bun --filter @dailify/web typecheck && bun --filter @dailify/web test`
Expected: PASS, PASS. Este é o primeiro ponto verde desde a Task 8.

- [ ] **Step 6: Commit shell + day + aside together**

```bash
git add -A apps/web/src
git commit -m "feat(web): view do dia como janela — chrome, gutter de horario, linha do agora, aside"
```

---

### Task 11: Verificação visual e de regressão

Nada de código novo. É o gate do spec.

**Files:** nenhum (ou correções pontuais que os checks apontarem)

- [ ] **Step 1: Full gate**

Run: `bun run check 2>&1 | tail -20`
Expected: exit 0. Testes: web ≥ 29 + os novos deste plano, server 40, shared 22. **Warnings de lint ≤ 43** — se subiu, o código novo introduziu um; conserte antes de seguir.

- [ ] **Step 2: Build and confirm the tokens shipped**

Run: `bun run build 2>&1 | tail -3 && grep -o "\-\-priority-[0-4]" apps/web/dist/assets/*.css | sort -u`
Expected: build verde e os cinco tokens listados.

- [ ] **Step 3: Screenshots**

Suba o dev server (`bun --filter @dailify/web dev`) e faça login. Capture `/dashboard` no dark e no light (o `ModeToggle` troca):

```bash
chromium --headless --disable-gpu --ignore-certificate-errors \
  --virtual-time-budget=6000 --window-size=1440,900 \
  --screenshot=/tmp/dash-dark.png https://localhost:1420/dashboard
```

`/dashboard` é protegido por Clerk, então o headless sem sessão cai no login — capture pelo navegador já logado, ou rode com um perfil persistente (`--user-data-dir=/tmp/chrome-dailify`) autenticando uma vez.

Confira, com o spec ao lado:
- o chão é preto neutro (`#0a0a0a`), não o cinza-azulado do `canvas`
- a janela do dia está um degrau acima do chão, com hairline visível
- o gutter de horário mostra cada horário **uma vez** por grupo
- a linha do "agora" está na posição certa (e some ao navegar para outro dia)
- o dia sem tarefas mostra o empty state
- **tema claro:** as pills de prioridade e o dot/linha do agora continuam legíveis

- [ ] **Step 4: Crimson audit**

Olhando o screenshot, liste cada elemento crimson e mapeie nos cinco papéis do spec §2: ação primária · view ativa · hoje · agora · tarefa aberta. Qualquer um que não mapeie sai.

- [ ] **Step 5: Regression grep on the touched files**

```bash
git diff --name-only main...HEAD -- 'apps/web/src/**/*.tsx' 'apps/web/src/**/*.ts' \
  | xargs grep -nE '(red|green|yellow|orange|gray|zinc)-[0-9]{3}|bg-surface-[a-z]+/[0-9]' || echo "limpo"
```

Expected: `limpo`. O grep é escopado aos arquivos deste branch de propósito — `task-preview.tsx` e `premium.tsx` estão declarados fora de escopo no spec e continuam com cor crua.

- [ ] **Step 6: Reduced motion**

No DevTools, Rendering → Emulate `prefers-reduced-motion: reduce`, recarregue.
Expected: a lista aparece sem stagger, **e a linha do "agora" continua no lugar certo** (o tick de `useNow` é dado, não animação — ele não deve ser desligado).

- [ ] **Step 7: Landing regression**

Capture `https://localhost:1420/` e compare com o screenshot da Task 2 Step 6.
Expected: idêntica, exceto o header (agora `SiteHeader`, sólido em vez de translúcido, e o botão virou pill).

- [ ] **Step 8: Close the bd issues and commit any fixes**

```bash
bd close Dailify-emm --reason="escala de prioridade tokenizada no redesign do dashboard (Dailify-r9i)"
git add -A && git commit -m "fix(web): achados da verificacao visual do dashboard" # só se houve correções
```

---

## O que este plano NÃO faz

Registrado para não parecer esquecimento. Cada item vira uma fase do plano seguinte, escrito depois que a view do dia estiver validada visualmente — as decisões do dia informam todas as outras.

| Fase | O que falta | Por que depois |
| --- | --- | --- |
| 3 | View do mês (`calendar-view.tsx`) + Sheet do dia; correção domingo-primeiro no mock da landing | densidade da célula depende de como o cartão de tarefa leu na prática |
| 4 | Sheet de detalhe em leitura + `edit-task.tsx` repaginado | é a fase cortável do spec |
| 5 | `NewTask` / `NewTaskVoice` por dentro (os diálogos, não só os gatilhos) | os gatilhos já saem certos na Task 10 |
| 6 | `/profile` (1074 linhas, só vocabulário) | independente de tudo acima |

Enquanto a fase 3 não chega, a view do mês continua com a aparência antiga — o toggle Hoje/Mês leva a uma tela que ainda não passou pelo passe. É uma inconsistência **temporária e visível**; se isso incomodar antes da fase 3 existir, a saída barata é esconder o toggle, não apressar o mês.
