# Dashboard redesign — fases 5, 4 e 6: formulários, detalhe e profile

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fechar o redesign do `/dashboard` — o interior dos diálogos de criação/edição (fase 5), a sheet de detalhe em modo leitura (fase 4) e o `/profile` (fase 6).

**Architecture:** `new-task.tsx` (239 linhas) e `edit-task.tsx` (338) renderizam o **mesmo** formulário de 7 campos, duplicado. A primeira task extrai um `TaskForm` compartilhado sem mudar aparência; a segunda restiliza esse único formulário e os dois ganham juntos. Só então entram a sheet de leitura e o profile.

**Tech Stack:** React 18 + TypeScript + Vite · Tailwind v4 · shadcn/ui · framer-motion · date-fns (`ptBR`) · vitest · bun

## Global Constraints

- Sem `as` type assertions (`as const` ok). Sem hex, só tokens. Sem `/opacity` em elemento interativo (focus rings do shadcn são exceção, ver `components/ui/CLAUDE.md`).
- Escada: `surface-page` → `surface-card` (janelas/diálogos) → campo/cartão **sem fill**, só `border-surface-line`; `surface-hover` no hover.
- Crimson só nos cinco papéis: ação primária · view ativa · hoje · agora · tarefa aberta. Num diálogo, a ação primária é **uma** (o botão de confirmar).
- Mono para dado de máquina (`font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground`); sans para texto humano; secundário é `text-content-secondary`.
- Toda string visível, inclusive `aria-label`, vem de `components/dashboard/copy.ts`.
- `useReducedMotion()` em bloco animado.
- **Comentários: só o não-óbvio, uma linha.** Nada de docblock narrando o que o código já diz.
- Gate: `bun run check` exit **0**. Warnings de lint em **41**, não podem subir.
- `bun` é o package manager. Nenhuma dependência nova.

---

### Task 1: extrair `TaskForm` (sem mudança visual)

**Files:**
- Create: `apps/web/src/components/dashboard/task-form.tsx`
- Modify: `apps/web/src/components/new-task.tsx`, `apps/web/src/components/edit-task.tsx`

**Interfaces:**
- Consumes: os pickers existentes (`ui/priority-picker`, `ui/tags-picker`, `ui/repeat-picker`, `ui/datetime-picker`, `ui/timefield`)
- Produces:
  ```ts
  export interface TaskFormValues {
    title: string; description: string; date: Date;
    duration: string; priority: number; tags?: string[]; repeat?: Repeat;
  }
  export function TaskForm(props: {
    task?: TaskProps;              // undefined = criação
    defaultDate?: Date;            // usado só na criação
    submitting?: boolean;
    submitLabel: string;
    onSubmit: (values: TaskFormValues) => void;
  }): JSX.Element
  ```

- [ ] **Step 1: Delete the dead code first**

`edit-task.tsx` tem um bloco de ~50 linhas comentado (uma versão antiga de `editTask`, mais dois blocos de JSX comentados no meio dos campos). Apague todos antes de mexer em qualquer coisa — extrair código com comentários mortos junto só espalha o lixo.

- [ ] **Step 2: Write `TaskForm` with the seven fields**

Mova para `task-form.tsx` os campos que hoje existem nos dois arquivos, **preservando exatamente as classes atuais** (a restilização é a Task 2): título (`Input`), descrição (`Textarea`), data (`DatetimePicker`), duração (`TimeField` + `DateInput`), prioridade (`PriorityPicker`), tags (`TagsPicker`), repetição (`RepeatPicker`), mais o botão de submit.

O estado interno segue o padrão que já existe (refs para título/descrição, `useState` para o resto). `task` alimenta os valores iniciais — os pickers já aceitam `task?: TaskProps` para isso. `handleDurationChange` e `handleDurationValue` (hoje duplicados nos dois arquivos) vêm junto.

Valide como o `new-task.tsx` já valida (título obrigatório, descrição obrigatória, etc.), chamando `toast.warning` com as mesmas mensagens — a tradução delas é a Task 2.

- [ ] **Step 3: Point both callers at it**

`new-task.tsx` mantém o `Dialog` + a chamada `createTask` e passa `onSubmit`. `edit-task.tsx` mantém o `Sheet` + `updateTask` + a checagem `isTaskModified` e passa `task` e `onSubmit`. Nenhum dos dois deve mais conter JSX de campo.

- [ ] **Step 4: Verify nothing changed visually**

Run: `bun run check` — exit 0, warnings ≤ 41 (devem **cair**, o código morto levava alguns).

Depois abra os dois no navegador (dev server em `https://localhost:1420`, worker em `:8787`) e confirme: criar tarefa e editar tarefa continuam funcionando, com os mesmos campos e a mesma aparência de antes. Esta task é refactor puro — **qualquer diferença visual aqui é bug**.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src
git commit -m "refactor(web): extrai TaskForm compartilhado por criar e editar"
```

---

### Task 2: restilizar `TaskForm` e os dois invólucros

**Files:**
- Modify: `apps/web/src/components/dashboard/task-form.tsx`, `new-task.tsx`, `edit-task.tsx`, `components/dashboard/copy.ts`

- [ ] **Step 1: Add the form copy**

Em `copy.ts`, uma seção `form` com: `title`, `titlePlaceholder`, `description`, `descriptionPlaceholder`, `date`, `duration`, `priority`, `tags`, `repeat`, `cancel`, `save`, `create`, `titleRequired`, `descriptionRequired`, `fieldsRequired`, `created`, `updated`, `noChanges`, `createError`, `limitReached`, `limitReachedHint`, `upgrade`. Tudo em pt-BR.

Substitua **todas** as strings inglesas hoje em `new-task.tsx` / `edit-task.tsx` (`"New Task"`, `"Create a new task"`, `"Title"`, `"Task title"`, `"Description"`, `"Date"`, `"Duration"`, `"Priority"`, `"Tags"`, `"Repeat"`, `"Cancel"`, `"Save"`, `"Edit Task"`, `"Update your task details"`, `"Title is required"`, `"Event has been created"`, `"Task updated successfully!"`, `"No changes made to the task."`, `"An error occurred"`, `"Get Premium"`).

- [ ] **Step 2: Restyle the fields**

- `Label` → `font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground`
- `Input` / `Textarea` → `border-surface-line bg-transparent`, foco em `focus-visible:border-accent-primary`
- os invólucros de `DatetimePicker` e do `TimeField` → `border-surface-line`, `focus-within:border-accent-primary`
- espaçamento entre campos: `gap-4`; rótulo↔campo: `gap-1.5`

- [ ] **Step 3: Restyle the wrappers**

`DialogContent` (criar) e `SheetContent` (editar): `bg-surface-card`, `border-surface-line`, `rounded-2xl` no dialog. Cabeçalho com título em `text-lg font-semibold tracking-[-0.01em]` e descrição em `text-sm text-content-secondary`.

Rodapé: Cancelar como `variant="ghost"`, e a ação primária em crimson (`bg-accent-primary text-primary-foreground hover:bg-accent-hover rounded-full`) com o rótulo vindo do copy — **não** um ícone `+` sozinho, como está hoje no `new-task.tsx`.

- [ ] **Step 4: Gate + visual**

`bun run check` exit 0. Abra os dois diálogos e confirme: um só crimson por diálogo (o botão de confirmar), rótulos em mono, campos com hairline.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(web): formularios de tarefa no vocabulario do dashboard, em pt-BR"
```

---

### Task 3: `NewTaskVoice` por dentro

**Files:** `apps/web/src/components/new-task-voice.tsx`, `apps/web/src/components/wave-form.tsx`, `copy.ts`

- [ ] **Step 1: Copy + restyle**

Strings para o `copy.ts` (`"Create task by voice"`, `"Record your voice to create a new task…"`, e o `sr-only` do gatilho). `DialogContent` no mesmo vocabulário da Task 2.

`wave-form.tsx:140` tem `bg-primary text-white` — troque `text-white` por `text-primary-foreground` (o token) e mantenha o crimson: gravar é a ação primária deste diálogo.

- [ ] **Step 2: Gate + commit**

`bun run check` exit 0.
```bash
git commit -am "feat(web): dialogo de voz no vocabulario do dashboard, em pt-BR"
```

---

### Task 4: sheet de detalhe em modo leitura (fase 4)

Hoje clicar numa tarefa abre a edição direto. Passa a abrir leitura, com Editar levando ao formulário. Fecha bd `Dailify-bie`.

**Files:**
- Create: `apps/web/src/components/dashboard/task-detail.tsx`
- Modify: `apps/web/src/components/dashboard/day-task-row.tsx`, `copy.ts`

- [ ] **Step 1: Build the read view**

Espelhe `components/landing/mocks/task-detail-sheet.tsx` — que é o mock que a landing já vende — com dados reais: título (`text-lg font-semibold tracking-[-0.01em]`), linha `Clock` mono com data·hora·duração, descrição em `text-sm text-content-secondary`, metadados de prioridade/repetição em pills `border-surface-line`, tags via `TagBadge` (`@/components/task-card`), e no rodapé **Concluir** em crimson mais Editar e Excluir.

Reuse os handlers que já existem em `day-task-row.tsx` (`completeTask` / `deleteTask` com escrita otimista só após o servidor responder) — extraia-os para o novo componente ou passe por prop, mas **não duplique a lógica**.

- [ ] **Step 2: Wire the two modes**

`DayTaskRow` passa a alternar entre leitura e edição dentro da mesma `Sheet`: um `useState<"read" | "edit">`, começando em `"read"`, e Editar troca para `"edit"`. Ao fechar, volta a `"read"`.

O menu `⋮` do cartão continua existindo com Concluir/Excluir — ele é o atalho; a sheet é o caminho completo.

- [ ] **Step 3: Gate + visual + commit**

`bun run check` exit 0. Confirme no navegador: clicar abre leitura, Editar mostra o formulário, Concluir marca e fecha, Excluir remove.

```bash
git commit -am "feat(web): sheet de detalhe da tarefa em modo leitura (bd Dailify-bie)"
```

---

### Task 5: `/profile` — vocabulário, sem reestruturar (fase 6)

**Files:** `apps/web/src/components/profileTabs.tsx` (1074 linhas), `apps/web/src/pages/profile.tsx`, `apps/web/src/components/app-header.tsx`

**Escopo é só pele.** Não mude layout, não mude a estrutura de abas, não extraia componentes. Se algum trecho pedir reestruturação, registre em bd em vez de fazer.

- [ ] **Step 1: Tokens no lugar das cores cruas**

Troque `border-green-500` → `border-success`, `bg-red-900/5` / `hover:bg-red-900/15` / `text-red-500` → `variant="destructive"` ou `text-destructive`, e `bg-primary/10` → `bg-accent-subtle`.

- [ ] **Step 2: Superfícies e tipografia**

`Card` → `bg-surface-card border-surface-line rounded-2xl`; rótulos de dado → mono `2xs` uppercase; texto secundário → `text-content-secondary`.

- [ ] **Step 3: O toggle que não pertence ali** (fecha bd `Dailify-o8u`)

`AppHeader` renderiza o `ViewToggle` incondicionalmente, e no `/profile` ele muda `isCalendar` sem efeito visível. Dê ao `AppHeader` uma prop `showViewToggle?: boolean` (default `true`) e passe `false` em `profile.tsx`.

- [ ] **Step 4: Gate + commit**

`bun run check` exit 0, warnings ≤ 41.
```bash
git commit -am "feat(web): /profile no vocabulario do dashboard; toggle so no dashboard"
```

---

### Task 6: verificação final

- [ ] **Step 1:** `bun run check` e `bun run build`, ambos exit 0.
- [ ] **Step 2:** grep de regressão nos arquivos tocados: zero `(red|green|yellow|orange|gray|zinc)-[0-9]{3}` e zero `bg-surface-*` com opacidade.
- [ ] **Step 3:** auditoria de crimson: liste cada ocorrência nos arquivos tocados e mapeie num dos cinco papéis. Num diálogo, a ação primária é **uma**.
- [ ] **Step 4:** grep por strings visíveis em inglês nos arquivos tocados.
- [ ] **Step 5:** feche `Dailify-bie` e `Dailify-o8u` no bd e commite o que sobrar.

## Fora de escopo

- `/premium` (cores cruas próprias, é página de conversão).
- `/task/:id` (`task-preview.tsx`) — renderizado como imagem; as cores existem para sobreviver à serialização.
- Reestruturar `profileTabs.tsx`.
- A duplicação da geração de grid entre `month-view.tsx` e `mini-calendar.tsx` (deferida na fase 3).
