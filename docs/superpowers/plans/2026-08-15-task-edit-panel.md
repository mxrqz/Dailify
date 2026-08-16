# Painel de editar tarefa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o painel da tarefa abre direto em edição, sem campo de descrição, com os links da tarefa visíveis e editáveis — e os dois defeitos de parser que apareceram no uso real ficam fechados.

**Architecture:** três frentes independentes que se juntam no fim. Os fixes de parser são função pura em `parse-task.ts`, testáveis sozinhos. A remoção de `description` é uma varredura vertical (migration → shared → servidor → web) que precisa acontecer de uma vez, senão o typecheck fica vermelho no meio. O painel em si é UI: perde o modo leitura, ganha rodapé de ações e uma seção de links.

**Tech Stack:** TypeScript, React 18, vitest (sem jsdom — o que tem lógica é função pura), Hono + D1 no servidor, Tailwind v4 com tokens em `global.css`, bun.

**Spec:** `docs/superpowers/specs/2026-08-15-task-edit-panel-design.md`

## Global Constraints

- **Sem `as`.** Type guard ou tipo de verdade. `as const` é permitido.
- **Sem hex nem cor arbitrária** — só token de `apps/web/src/global.css`.
- **Nenhuma string literal no JSX** — tudo em `apps/web/src/components/dashboard/copy.ts`, em pt-BR.
- **Comentário só pro não-óbvio** — uma linha explicando *por quê*, nunca docblock narrando o código.
- **Prettier `printWidth: 100`** — `bun run format` antes de commitar.
- **Gate completo:** `bun run check` na raiz.
- **Datas são epoch-ms `number`** na fronteira com o servidor.
- **Commits em português, sem acento, conventional commits.**
- **Todo comando roda de** `/mnt/LinuxData/home/mxrqz/projects/Dailify/.claude/worktrees/task-edit-panel`.
- **O snippet do brief não é autoridade — o caso de teste é.** No plano anterior, 5 das 9 tarefas tinham defeito no código de exemplo. Rode os casos contra o snippet antes de aceitá-lo; se não passar, conserte e diga no relatório.

---

### Task 1: `de 14h às 15h` deixa de virar duração de 14 horas

`parseDuration` exige que prefixo e conector sejam pareados (`de`↔`ate`, `das`/`da`↔`as`). Quando o par não bate, o intervalo é rejeitado e o fallback de duração explícita lê `"de 14h"` como 14 horas.

**Files:**
- Modify: `apps/web/src/functions/parse-task.ts:554` (a linha do `pairValid`)
- Test: `apps/web/src/functions/parse-task.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: nenhuma assinatura nova — só comportamento de `parseDuration`

- [ ] **Step 1: Escreva os testes que falham**

Acrescente a `apps/web/src/functions/parse-task.test.ts`:

```ts
describe("intervalo — prefixo e conector misturados", () => {
  it.each([
    ["call de 14h às 15h", "1h", 14, 0],
    ["call das 14h até 15h", "1h", 14, 0],
    ["call de 14 às 15", "1h", 14, 0],
    ["call das 9 até 10:30", "1h30m", 9, 0],
  ])("%j → %s começando %d:%d", (input, duration, hour, minute) => {
    const parsed = parseDuration(normalize(input));
    expect(parsed?.duration).toBe(duration);
    expect(parsed?.start).toEqual({ hour, minute });
  });

  it.each([
    "jogo de 2 a 3",
    "páginas de 15 a 20",
    "de 15/08 a 16/08",
    "férias de 10 a 20 de agosto",
  ])("%j continua não sendo intervalo", (input) => {
    expect(parseDuration(normalize(input))).toBeNull();
  });
});
```

E confirme que o título sai limpo, que é o efeito que o usuário vê:

```ts
describe("intervalo misturado — título limpo", () => {
  it.each([
    ["call de 14h às 15h", "call"],
    ["call das 14h até 15h", "call"],
  ])("%j → %j", (input, expected) => {
    expect(parseTaskText(input, NOW).text).toBe(expected);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/web test -- parse-task
```

Esperado: FAIL. `"call de 14h às 15h"` devolve `duration: "14h"` (o fallback lendo `"de 14h"`), e o título vem `"call às 15h"`.

- [ ] **Step 3: Implemente**

Em `apps/web/src/functions/parse-task.ts:554`, o `pairValid` deixa de exigir o par:

```ts
    const [, prefix, hour1, minute1, connector, hour2, minute2] = range;
```

Remova a linha do `pairValid` e tire-o da condição do `if`. O prefixo e o conector continuam **obrigatórios** (estão no próprio regex, linhas 548-550) — é isso que barra `"jogo de 2 a 3"`, não o pareamento entre eles.

Atualize o comentário de 546-548, que hoje descreve a regra que está saindo:

```ts
  // "-"/"—" nunca aparecem aqui: normalize() já trocou hífen e travessão por espaço antes do texto
  // chegar. Prefixo E conector são obrigatórios — é o conector que barra "jogo de 2 a 3"; exigir
  // que combinem entre si só recusava "de 14h às 15h", que é português normal.
```

> Medição que já existe, do review final do branch anterior: com o pareamento solto a suíte passa inteira e o diff em 347 entradas reais dá 3 mudanças, as 3 melhorias.

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/web test -- parse-task
```

Esperado: PASS, incluindo todos os casos pré-existentes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/functions/parse-task.ts apps/web/src/functions/parse-task.test.ts
git commit -m "fix(web): prefixo e conector do intervalo nao precisam combinar entre si"
```

---

### Task 2: preposição órfã sai do título

Quando o recorte encosta no fim da frase, a preposição imediatamente à esquerda fica apontando pro nada: `"reunião no meet.google.com/x hoje às 16h"` salva `"reunião no"`.

**Files:**
- Modify: `apps/web/src/functions/parse-task.ts` (`joinAcrossCut`, linhas 646-681)
- Test: `apps/web/src/functions/parse-task.test.ts`

**Interfaces:**
- Consumes: `cut(input: string, spans: Span[]): string` — já exportada
- Produces: nenhuma assinatura nova

- [ ] **Step 1: Escreva os testes que falham**

```ts
describe("preposição órfã na fronteira do corte", () => {
  it.each([
    ["reunião no meet.google.com/abc hoje às 16h", "reunião"],
    ["call na meet.google.com/abc amanhã", "call"],
    ["daily em meet.google.com/abc hoje", "daily"],
    ["assistir pelo youtube.com/watch?v=1 hoje", "assistir"],
  ])("%j → %j", (input, expected) => {
    expect(parseTaskText(input, NOW).text).toBe(expected);
  });

  it.each([
    ["comprar pão no mercado hoje", "comprar pão no mercado"],
    ["reunião na sala 3 amanhã", "reunião na sala 3"],
    ["deixar com o porteiro hoje", "deixar com o porteiro"],
    ["reunião no meet.google.com/abc com o time hoje", "reunião no meet com o time"],
  ])("%j → %j (não mexe no que não foi recortado)", (input, expected) => {
    expect(parseTaskText(input, NOW).text).toBe(expected);
  });
});
```

> O último caso do segundo bloco é o mais importante: o link foi recortado, mas **sobra texto depois dele**, então o `"no"` ainda tem a que se referir e não pode sumir. Se sua implementação apagar o `"no"` aí, ela está varrendo texto que o usuário escreveu, e não a costura do corte.

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/web test -- parse-task
```

Esperado: FAIL nos quatro primeiros (`"reunião no"` em vez de `"reunião"`). Os quatro do segundo bloco devem **passar** já — são as guardas de não-regressão.

- [ ] **Step 3: Implemente**

Em `apps/web/src/functions/parse-task.ts`, ao lado do `ORPHAN_PUNCT`:

```ts
// Preposição que só existia pra apontar pro trecho recortado ("reunião NO meet…"). Sem o trecho,
// ela aponta pro nada. Só some quando nada sobra depois dela — senão é texto do usuário.
const ORPHAN_PREP = /(?:^|\s)(no|na|nos|nas|em|pelo|pela|pelos|pelas|via|pro|pra|com|de|do|da)$/i;
```

Dentro de `joinAcrossCut`, acrescente a regra **junto da que já trata separador de lista pendurado** — as duas têm a mesma pré-condição (`isLast && !rightTrimmed`), que é o que garante que nada sobrou à direita:

```ts
  // corte foi ate o fim da frase e deixou separador de lista pendurado, sem nada depois pra separar
  if (isLast && !rightTrimmed && leftLast && /[,;]/.test(leftLast)) {
    return leftTrimmed.slice(0, -1);
  }

  // mesma pre-condicao: corte ate o fim, nada a direita — a preposicao final perdeu o referente
  if (isLast && !rightTrimmed) {
    const withoutPrep = leftTrimmed.replace(ORPHAN_PREP, "");
    if (withoutPrep !== leftTrimmed) return joinAcrossCut(withoutPrep, "", isLast);
  }
```

A recursão existe pro caso de sobrar pontuação embaixo da preposição removida (`"reunião, no <corte>"`).

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/web test -- parse-task
bun --filter @dailify/web test
```

Esperado: PASS nos dois. Se algum caso antigo de recorte quebrou, o culpado é a regra disparando sem `isLast` — ela **só** pode agir quando o corte vai até o fim.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/functions/parse-task.ts apps/web/src/functions/parse-task.test.ts
git commit -m "fix(web): preposicao sem referente sai do titulo quando o corte vai ate o fim"
```

---

### Task 3: `isTaskModified` passa a comparar `links`

Hoje ele compara título, duração, prioridade, tags, data, alerta e recorrência — não `links`. É inerte enquanto nada edita link; o painel desta spec é a primeira tela que edita, e sem esta task editar só um link resulta em "nenhuma alteração" e o salvamento é descartado em silêncio.

**Files:**
- Modify: `apps/web/src/functions/functions.ts:69-84`
- Test: `apps/web/src/functions/functions.test.ts`

**Interfaces:**
- Consumes: `Task.links?: string[]` (já existe)
- Produces: `isTaskModified(task, updated)` passa a detectar mudança em `links`

- [ ] **Step 1: Escreva os testes que falham**

Acrescente a `apps/web/src/functions/functions.test.ts`. Use o helper de task que o arquivo já tiver; se não houver, monte o objeto inline com os campos obrigatórios de `TaskProps`.

```ts
describe("isTaskModified — links", () => {
  const base: TaskProps = {
    id: "t1",
    title: "Reunião",
    date: new Date(2026, 7, 15, 15).getTime(),
    duration: "1h",
    priority: 0,
    repeat: "Off",
    completed: [],
  };

  it("adicionar link conta como alteração", () => {
    expect(isTaskModified(base, { ...base, links: ["https://x.com"] })).toBe(true);
  });

  it("remover link conta como alteração", () => {
    const withLink = { ...base, links: ["https://x.com"] };
    expect(isTaskModified(withLink, base)).toBe(true);
  });

  it("trocar a URL conta como alteração", () => {
    expect(
      isTaskModified({ ...base, links: ["https://x.com"] }, { ...base, links: ["https://y.com"] }),
    ).toBe(true);
  });

  it("mesma lista não conta como alteração", () => {
    const a = { ...base, links: ["https://x.com", "https://y.com"] };
    expect(isTaskModified(a, { ...a })).toBe(false);
  });

  it("sem links dos dois lados não conta como alteração", () => {
    expect(isTaskModified(base, { ...base })).toBe(false);
  });
});
```

- [ ] **Step 2: Rode e confirme que falha**

```bash
bun --filter @dailify/web test -- functions
```

Esperado: FAIL nos três primeiros — todos voltam `false` porque `links` não é comparado.

- [ ] **Step 3: Implemente**

Em `apps/web/src/functions/functions.ts`, dentro de `isTaskModified`, ao lado da comparação de `tags` (que já usa o mesmo padrão):

```ts
  if (JSON.stringify(task.links) !== JSON.stringify(updated.links)) return true;
```

- [ ] **Step 4: Rode e confirme que passa**

```bash
bun --filter @dailify/web test -- functions
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/functions/functions.ts apps/web/src/functions/functions.test.ts
git commit -m "fix(web): isTaskModified compara links, senao editar so link nao salva"
```

---

### Task 4: `description` sai do banco e do model compartilhado

Vertical inteira do dado. Precisa acontecer num commit só — meio caminho deixa o typecheck vermelho.

**Files:**
- Create: `apps/server/migrations/0003_drop_description.sql`
- Modify: `packages/shared/src/types.ts` (interface `Task`)
- Modify: `apps/server/src/db/tasks.ts` (`Row`, `rowToTask`, `insertTask`, `updateTask`)
- Modify: `apps/server/src/routes/tasks.ts` (POST)
- Modify: `apps/server/src/lib/openai.ts` (prompt + type guard)
- Modify: `apps/server/src/routes/voice.ts`
- Modify: `packages/shared/src/recurrence.test.ts` (fixtures)
- Test: `apps/server/test/` (a suíte inteira precisa seguir verde)

**Interfaces:**
- Consumes: nada
- Produces: `Task` sem o campo `description`; a coluna deixa de existir no D1

- [ ] **Step 1: Rode a suíte antes de mexer, pra ter a linha de base**

```bash
bun --filter @dailify/server test
```

Anote a contagem. Ela precisa voltar igual (ou maior) no fim.

- [ ] **Step 2: Crie a migration**

`apps/server/migrations/0003_drop_description.sql`:

```sql
ALTER TABLE tasks DROP COLUMN description;
```

- [ ] **Step 3: Tire o campo do model e do servidor**

`packages/shared/src/types.ts` — remova a linha `description: string;` da interface `Task`.

`apps/server/src/db/tasks.ts`, quatro pontos:
- `interface Row`: remova `description: string;`
- `rowToTask`: remova `description: r.description,`
- `insertTask`: tire `description` da lista de colunas, tire um `?` do `VALUES` e remova `task.description` do `.bind()`
- `updateTask`: tire `description=?` do `SET` e remova `next.description` do `.bind()`

`apps/server/src/routes/tasks.ts` — no POST, remova `description: body.description ?? "",` do objeto `task`.

`apps/server/src/lib/openai.ts` — remova o campo `description` da interface de resposta, a checagem dele no type guard, e a linha `"description"` do prompt.

`apps/server/src/routes/voice.ts` — pare de repassar o campo.

`packages/shared/src/recurrence.test.ts` — remova `description` das fixtures.

- [ ] **Step 4: Rode a suíte do servidor**

```bash
bun --filter @dailify/server test
```

Esperado: PASS, contagem igual à do Step 1. A suíte aplica as migrations em `beforeAll` (`applyD1Migrations`), então a `0003` entra sozinha. Se algum teste ainda mandar `description` no payload, tire de lá também — o campo não existe mais.

- [ ] **Step 5: Commit**

```bash
git add apps/server packages/shared
git commit -m "feat(server): remove a coluna description da tarefa"
```

---

### Task 5: `description` sai do web, e o rótulo vira "Tarefa"

**Files:**
- Modify: `apps/web/src/components/dashboard/task-form.tsx`
- Modify: `apps/web/src/components/dashboard/copy.ts`
- Modify: `apps/web/src/components/edit-task.tsx`
- Modify: `apps/web/src/components/new-task.tsx`
- Modify: `apps/web/src/components/new-task-voice.tsx`
- Modify: `apps/web/src/components/dashboard/task-detail.tsx`
- Modify: `apps/web/src/pages/home.tsx`

**Interfaces:**
- Consumes: `Task` sem `description` (Task 4)
- Produces: `TaskFormValues` sem o campo `description`

- [ ] **Step 1: Copy primeiro**

Em `apps/web/src/components/dashboard/copy.ts`, bloco `form`:
- `title: "Título"` vira `title: "Tarefa"`
- removem-se `description`, `descriptionPlaceholder` e `descriptionRequired`

E no bloco `voice` (linha ~120), o texto instrui a ditar um campo que deixa de existir:

```ts
    description:
      "Grave sua voz dizendo a tarefa, a data, o horário e a duração.",
```

- [ ] **Step 2: Tire o campo do formulário**

`apps/web/src/components/dashboard/task-form.tsx`:
- remova `descriptionRef` (`:57`) e o bloco `<div>` inteiro do `<Textarea>` de descrição
- em `handleSubmit`, remova o `desc`, a validação `if (!desc)` e o campo do objeto passado a `onSubmit`
- remova `description` de `TaskFormValues`
- remova o import de `Textarea` se ele ficar órfão

- [ ] **Step 3: Tire dos consumidores**

`edit-task.tsx`: remova `description: values.description,` do `taskData`.
`new-task.tsx` e `new-task-voice.tsx`: remova `description` do payload.
`task-detail.tsx`: remova o `<p>` que renderiza `task.description || copy.task.noDescription`. (Este arquivo é apagado inteiro na Task 6 — a edição aqui existe só pra manter o typecheck verde no fim desta task, já que o campo deixou de existir no model.)
`home.tsx`: remova `description: "",` do `composerTaskInput`.

- [ ] **Step 4: Rode o gate do web**

```bash
bun --filter @dailify/web test
bun --filter @dailify/web typecheck
```

Esperado: PASS nos dois. Typecheck é o juiz aqui — ele acusa qualquer consumidor esquecido.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): campo de descricao sai do formulario, rotulo vira Tarefa"
```

---

### Task 6: o painel abre direto em edição

**Files:**
- Modify: `apps/web/src/components/dashboard/day-task-row.tsx`
- Modify: `apps/web/src/components/edit-task.tsx` (rodapé)
- Modify: `apps/web/src/components/dashboard/copy.ts`
- Delete: `apps/web/src/components/dashboard/task-detail.tsx`

**Interfaces:**
- Consumes: `useTaskActions(task)` → `{ onComplete, onDelete }` (`hooks/useTaskActions.ts`), `getCompletionDate(task, day)` (`functions/functions.ts`)
- Produces: `EditTaskContent({ task, day, onClose })` — ganha `day` e `onClose`, que antes eram do `TaskDetailContent`

- [ ] **Step 1: Simplifique o `DayTaskRow`**

`apps/web/src/components/dashboard/day-task-row.tsx`: remova o estado `mode` e o ramo condicional. O corpo do `EditTask` passa a ser:

```tsx
      <TaskCard
        {...data}
        time={showTime ? data.time : ""}
        selected={open}
        onClick={() => setOpen(true)}
        actions={<TaskActions task={task} />}
      />

      <EditTaskContent task={task} day={day} onClose={() => setOpen(false)} />
```

E o `onOpenChange` perde a linha que resetava o modo:

```tsx
  const onOpenChange = (next: boolean) => setOpen(next);
```

Remova o import de `TaskDetailContent` e apague o arquivo:

```bash
git rm apps/web/src/components/dashboard/task-detail.tsx
```

- [ ] **Step 2: Rodapé com as quatro ações**

`apps/web/src/components/edit-task.tsx`: a assinatura vira `{ task, day, onClose }: { task: TaskProps; day: Date; onClose: () => void }`, e o componente passa a usar as ações:

```tsx
  const { onComplete, onDelete } = useTaskActions(task);
  const completed = getCompletionDate(task, day) === true;
```

O `SheetFooter` vira:

```tsx
      <SheetFooter className="flex-row items-center justify-between gap-2">
        <Button
          variant="ghost"
          className="cursor-pointer gap-2 text-destructive hover:text-destructive"
          onClick={() => {
            void onDelete();
            onClose();
          }}
        >
          <Trash2Icon className="size-4" />
          {copy.task.delete}
        </Button>

        <div className="flex items-center gap-2">
          <SheetClose asChild>
            <Button variant="ghost" className="cursor-pointer">
              {copy.form.cancel}
            </Button>
          </SheetClose>

          <Button
            variant="ghost"
            disabled={completed}
            className="cursor-pointer gap-2"
            onClick={() => {
              void onComplete();
              onClose();
            }}
          >
            <CheckIcon className="size-4" />
            {completed ? copy.task.completed : copy.task.complete}
          </Button>

          <Button
            type="submit"
            form={formId}
            className="cursor-pointer rounded-full bg-accent-primary px-5 text-primary-foreground hover:bg-accent-hover"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : copy.form.save}
          </Button>
        </div>
      </SheetFooter>
```

Imports novos: `CheckIcon`, `Trash2Icon` de `lucide-react`; `useTaskActions` de `@/hooks/useTaskActions`; `getCompletionDate` de `@/functions/functions`.

- [ ] **Step 3: Copy do cabeçalho**

O cabeçalho ainda diz "Editar tarefa / Ajuste os detalhes e salve", que fazia sentido quando havia um modo leitura pra contrastar. Em `copy.ts`, bloco `form`:

```ts
    editTitle: "Tarefa",
    editDescription: "Edite e salve, ou conclua direto.",
```

O `editDescription` novo é o que a tela faz agora: as quatro ações do rodapé, incluindo concluir sem passar pelo formulário.

Remova `copy.task.noDescription`, que fica órfã com a deleção do `task-detail.tsx`.

- [ ] **Step 4: Rode o gate do web**

```bash
bun --filter @dailify/web test
bun --filter @dailify/web typecheck
bun --filter @dailify/web lint
```

Esperado: PASS nos três. O typecheck acusa qualquer import órfão do arquivo deletado.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): painel da tarefa abre direto em edicao, sem modo leitura"
```

---

### Task 7: links no painel

A única UI realmente nova do plano.

**Files:**
- Create: `apps/web/src/components/dashboard/links-field.tsx`
- Modify: `apps/web/src/components/dashboard/task-form.tsx`
- Modify: `apps/web/src/components/dashboard/copy.ts`

**Interfaces:**
- Consumes: `parseLinks(input: string): { urls: string[]; spans: Span[] }` (`@/functions/parse-links`), `linkLabel(url: string): string` (`@/functions/link-label`)
- Produces:
  ```tsx
  export function LinksField({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (links: string[]) => void;
  }): JSX.Element
  ```
  e `TaskFormValues` ganha `links?: string[]`

- [ ] **Step 1: Copy**

Em `copy.ts`, bloco `form`:

```ts
    links: "Links",
    linkAdd: "Adicionar link",
    linkEdit: "Editar link",
    linkRemove: "Remover link",
    linkPlaceholder: "cole a URL",
    linkInvalid: "URL inválida",
    linkLimit: "Máximo de 10 links por tarefa",
```

- [ ] **Step 2: Escreva o componente**

`apps/web/src/components/dashboard/links-field.tsx`:

```tsx
import { useState } from "react";
import { LinkIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkLabel } from "@/functions/link-label";
import { parseLinks } from "@/functions/parse-links";
import { cn } from "@/lib/utils";

const MAX_LINKS = 10; // igual ao teto da rota; passar disso volta 400 do servidor

/** A mesma regra do detector do composer decide o que é URL aqui — sem segunda definição. */
function normalizeUrl(raw: string): string | null {
  const { urls } = parseLinks(raw.trim());
  return urls.length === 1 ? urls[0] : null;
}

const chipClass =
  "inline-flex items-center gap-1.5 rounded-md border border-surface-line px-2 py-1 " +
  "font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground";

export function LinksField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (links: string[]) => void;
}): JSX.Element {
  // índice em edição, ou "new" pro input de adicionar; null = nenhum input aberto
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);

  const openEditor = (target: number | "new") => {
    setEditing(target);
    setDraft(typeof target === "number" ? value[target] : "");
    setInvalid(false);
  };

  const commit = () => {
    const url = normalizeUrl(draft);
    if (!url) {
      setInvalid(true);
      return;
    }
    onChange(editing === "new" ? [...value, url] : value.map((v, i) => (i === editing ? url : v)));
    setEditing(null);
    setDraft("");
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((url, index) =>
        editing === index ? (
          <Input
            key={url}
            autoFocus
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(false);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") setEditing(null);
            }}
            aria-label={copy.form.linkEdit}
            aria-invalid={invalid}
            className={cn("h-8 w-64", invalid && "border-destructive")}
          />
        ) : (
          <span key={url} className={chipClass}>
            <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              {linkLabel(url)}
            </a>
            <button
              type="button"
              aria-label={copy.form.linkEdit}
              onClick={() => openEditor(index)}
              className="text-muted-foreground hover:text-foreground"
            >
              <PencilIcon className="size-3" />
            </button>
            <button
              type="button"
              aria-label={copy.form.linkRemove}
              onClick={() => onChange(value.filter((_, i) => i !== index))}
              className="text-muted-foreground hover:text-destructive"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ),
      )}

      {editing === "new" ? (
        <Input
          autoFocus
          value={draft}
          placeholder={copy.form.linkPlaceholder}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") setEditing(null);
          }}
          aria-label={copy.form.linkAdd}
          aria-invalid={invalid}
          className={cn("h-8 w-64", invalid && "border-destructive")}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          disabled={value.length >= MAX_LINKS}
          title={value.length >= MAX_LINKS ? copy.form.linkLimit : undefined}
          onClick={() => openEditor("new")}
          className="h-8 gap-1.5 text-2xs"
        >
          <PlusIcon className="size-3" />
          {copy.form.linkAdd}
        </Button>
      )}
    </div>
  );
}
```

> `onBlur={commit}` com `invalid` só marcando o input tem um efeito a checar no Step 4: sair do campo com URL inválida mantém o input aberto e marcado, não descarta silenciosamente. Confirme esse comportamento; se ele prender o usuário no campo, troque o `onBlur` por descarte quando o rascunho for inválido **e** o campo tiver sido aberto vazio.

- [ ] **Step 3: Monte no formulário**

`apps/web/src/components/dashboard/task-form.tsx`:

```tsx
  const [links, setLinks] = useState<string[]>(task?.links ?? []);
```

`TaskFormValues` ganha `links?: string[]`, e o `onSubmit` passa `links: links.length ? links : undefined`.

O bloco de UI entra depois de duração, seguindo o padrão dos vizinhos:

```tsx
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="links" className={labelClass}>
          {copy.form.links}
        </Label>
        <LinksField value={links} onChange={setLinks} />
      </div>
```

E `edit-task.tsx` passa `links: values.links` no `taskData`.

- [ ] **Step 4: Verifique no app**

```bash
bun run dev
```

Abra `/dashboard`, crie uma tarefa com link pelo composer (`reunião amanhã às 10h meet.google.com/abc`), clique nela e confirme:

1. o chip do link aparece no painel, com o rótulo "Google Meet"
2. clicar no rótulo abre em aba nova
3. o lápis vira input com a URL atual; Enter salva; Esc cancela
4. o `✕` remove o chip
5. "Adicionar link" com uma URL válida cria o chip; com texto qualquer (`abc`) marca erro e não cria
6. salvar persiste — feche e reabra o painel pra confirmar
7. editar **só** o link e salvar não cai em "nenhuma alteração" (é a Task 3 valendo)

Anote o que não conseguir verificar em vez de presumir.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): links da tarefa viram chips clicaveis e editaveis no painel"
```

---

### Task 8: passe visual da sheet

**Files:**
- Modify: `apps/web/src/components/edit-task.tsx`
- Modify: `apps/web/src/components/dashboard/task-form.tsx`

**Interfaces:**
- Consumes: tokens de `apps/web/src/global.css`
- Produces: nada

- [ ] **Step 1: Levante o que destoa**

Compare a sheet com o composer e a lista do dia, que já passaram pelo redesign (`docs/superpowers/specs/2026-08-10-dashboard-redesign-design.md`). Liste no relatório o que está fora do padrão antes de mexer — raio, superfície, borda, tipografia de rótulo, estado de foco.

- [ ] **Step 2: Alinhe**

Aplique, sem inventar linguagem nova:
- superfícies e bordas por token: `surface-card`, `surface-line`, `surface-page`
- raio `rounded-panel` no container, como os outros painéis
- rótulo de campo em `font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground` (é o `labelClass` que o `task-form` já define)
- foco em `focus-visible:border-accent-primary`
- estados sólidos em vez de `/opacity` (bd `k00`)

**Nenhum hex, nenhuma cor arbitrária.** Se faltar um token pro que você precisa, pare e diga no relatório — não invente valor.

- [ ] **Step 3: Verifique nos dois temas**

```bash
bun run dev
```

Abra o painel no tema claro e no escuro (toggle sol/lua). Confirme contraste do texto sobre a superfície e que nenhum estado de foco sumiu. Anote o que não conseguir verificar.

- [ ] **Step 4: Gate**

```bash
bun run check
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "style(web): sheet da tarefa alinhada aos tokens do dashboard"
```

---

## Verificação final

- [ ] `bun run check` verde na raiz
- [ ] `bd close Dailify-94y Dailify-xgz`
- [ ] `git push -u origin worktree-task-edit-panel`
- [ ] **Antes de publicar em produção:** `cd apps/server && bunx wrangler d1 migrations apply dailify --remote` — a `0003` dropa uma coluna, e sem ela o servidor novo tenta escrever num schema que ainda tem `description NOT NULL`

## Fora deste plano

Remover a prioridade (25 arquivos, incluindo landing e prompt de voz), `Dailify-1xr` (tarefa sem data), `Dailify-yok` (tags via `#`), `Dailify-p84` (recorrência no texto).
