# Painel de editar tarefa — abre direto, sem descrição, com links

**Data:** 2026-08-15
**Branch:** `worktree-task-edit-panel`
**Fecha:** `Dailify-94y`, `Dailify-xgz`
**Depende de:** spec `2026-08-14-composer-extraction-design.md` (já mergeada) — é ela que preenche `links`

## Problema

O composer virou um campo só e passou a extrair data, duração e links da frase. O painel do outro
lado não acompanhou: ele ainda é a tela pré-redesign, e três coisas nela estão erradas agora.

**Um clique a mais que não serve pra nada.** Clicar no cartão abre a sheet em modo leitura
(`task-detail.tsx`), e só o botão "Editar" troca o conteúdo pelo formulário
(`day-task-row.tsx:76,94-103`). A leitura não faz nada que a edição não faça — mostra os mesmos
campos, sem poder mexer.

**A descrição não tem mais de onde vir.** O composer cria toda tarefa com `description: ""`
(`home.tsx`), e é ele o único caminho de criação em uso. O campo continua no formulário, exigido
na validação (`task-form.tsx:88-90`), então toda tarefa criada pelo composer trava ao salvar
edição até o usuário inventar uma descrição. Dois campos de texto onde o produto passou a ter um.

**Os links não aparecem em lugar nenhum.** A coluna existe, a rota valida, o composer extrai — e
a tarefa salva não mostra o link em tela alguma. O dado mais acionável da tarefa (a sala da
reunião) está no banco e invisível.

Somam-se dois defeitos do parser que a verificação em uso revelou, ambos com issue aberta:
`Dailify-94y` (`"de 14h às 15h"` vira duração de 14 horas) e `Dailify-xgz` (preposição órfã:
`"reunião no meet.google.com/x hoje às 16h"` salva o título `"reunião no"`).

## Decisões

**A prioridade fica.** Chegou a estar no escopo e saiu: ela aparece em 25 arquivos, incluindo o
bento e dois blurbs da landing, a bandeira do cartão e o prompt da criação por voz. Removê-la é um
projeto próprio, não um item de um passe no painel.

**`description` sai inteira, sem migração de dados.** Não é fusão com o título nem primeira-linha-é-
título: a coluna é dropada e o campo desaparece do model. Consultei o D1 de produção antes de
decidir — 2 tarefas no total, 1 com descrição — então o texto que se perde é conhecido e
irrelevante. O rótulo do campo que sobra passa de `TÍTULO` para `TAREFA`.

**O painel abre em edição.** O modo leitura deixa de existir, e com ele o `TaskDetailContent`.
Concluir e Excluir, que moravam no rodapé da leitura, passam pro rodapé do painel.

**Link editável, não só clicável.** O composer é o único jeito de um link entrar numa tarefa hoje.
Sem UI de edição, uma URL errada não tem conserto e uma tarefa antiga nunca ganha link. É a única
parte do escopo com UI realmente nova, e é ela que faz o campo `links` valer.

## Design

### 1. `description` sai

| Camada | O que muda |
| --- | --- |
| `apps/server/migrations/0003_drop_description.sql` | `ALTER TABLE tasks DROP COLUMN description` |
| `packages/shared/src/types.ts` | campo sai de `Task` (e por consequência de `TaskInput`) |
| `apps/server/src/db/tasks.ts` | `Row`, `rowToTask`, as colunas do `INSERT` e o `SET` do `UPDATE` |
| `apps/server/src/routes/tasks.ts` | `description: body.description ?? ""` sai do POST |
| `apps/server/src/lib/openai.ts` | a linha `"description"` sai do prompt e do type guard |
| `apps/server/src/routes/voice.ts` | para de repassar o campo |
| `apps/web/src/components/dashboard/task-form.tsx` | o `<Textarea>`, o `descriptionRef` e a validação `descriptionRequired` |
| `apps/web/src/components/{edit-task,new-task,new-task-voice}.tsx` | param de montar `description` no payload |
| `apps/web/src/pages/home.tsx` | `description: ""` sai do `composerTaskInput` |
| `apps/web/src/functions/functions.ts` | a comparação de `description` sai do `isTaskModified` |
| `apps/web/src/components/dashboard/copy.ts` | `form.title` vira `"Tarefa"`; `form.description`, `form.descriptionPlaceholder` e `form.descriptionRequired` saem |

Um detalhe de copy que é fácil deixar passar: `copy.voice.description` (`copy.ts:120-122`) não é o
campo da tarefa — é o texto do diálogo de voz — mas ele diz *"dizendo o **título**, a data, o horário
e os outros detalhes"*. Com o rótulo virando "Tarefa" e a descrição deixando de existir, essa frase
passa a instruir o usuário a ditar um campo que não existe mais. Reescrever junto.

**`isTaskModified` ganha `links` no mesmo movimento** (`functions.ts:69-84`). Ele compara título,
duração, prioridade, tags, data, alerta e recorrência — e não compara `links`. Sem isso, editar
**só** um link resulta em "nenhuma alteração" e o salvamento é descartado em silêncio: o painel
desta spec seria a primeira tela capaz de disparar esse bug.

### 2. O painel abre em edição

`day-task-row.tsx` perde o estado `mode` (`:76`) e o ramo condicional (`:94-103`) — a sheet monta
`EditTaskContent` direto. `task-detail.tsx` é deletado.

O rodapé do painel passa a ter quatro ações, herdando o comportamento que já existe em
`useTaskActions` (`hooks/useTaskActions.ts`), que é justamente o hook compartilhado entre o menu ⋮
do cartão e a sheet de leitura que morre aqui:

```
┌──────────────────────────────────────────────┐
│  Excluir            Cancelar  Concluir  Salvar│
└──────────────────────────────────────────────┘
   destrutivo,        ghost     ghost    accent
   à esquerda
```

Concluir e Excluir fecham a sheet, como fazem hoje. `Concluir` fica desabilitado quando a tarefa
já está concluída no dia (`getCompletionDate`), igual ao comportamento atual.

### 3. Links no painel

Uma seção nova no formulário, abaixo de duração:

```
LINKS
┌─────────────────────────┐  ┌──────────────┐
│ ▸ Google Meet         ✎ ✕│  │ + Adicionar  │
└─────────────────────────┘  └──────────────┘
   ↑ abre em aba nova
```

- **Abrir:** o rótulo é um `<a target="_blank" rel="noopener noreferrer">`. O `rel` não é opcional:
  sem ele a página de destino recebe `window.opener` e pode navegar a aba de origem.
- **Rótulo:** `linkLabel()` (`functions/link-label.ts`), já existente — mapa de hostname, sem rede.
- **Editar:** o lápis troca o chip por um `<input type="url">` com o valor atual; confirma no Enter
  ou no blur, cancela no Esc.
- **Remover:** o `✕` tira da lista.
- **Adicionar:** abre um input vazio no fim da lista.

A validação de URL do cliente reusa `parseLinks` (`functions/parse-links.ts`) sobre o valor
digitado: se ele não produzir exatamente uma URL, o input fica em estado de erro e não confirma.
Isso alinha cliente e servidor sem duplicar regra — hoje o composer aceita coisas que a rota
rejeita (credencial embutida, mais de 10 links, URL acima de 2048), e o usuário só descobre no
`400 invalid links`.

O teto de 10 do servidor vira gate visível: o botão "Adicionar" desabilita no décimo.

### 4. Passe visual da sheet

A sheet ainda tem a cara pré-redesign, enquanto o composer e a lista já passaram pelo passe do
`2026-08-10-dashboard-redesign-design.md`. Alinhar com o que já existe, sem inventar linguagem
nova:

- superfícies e bordas por token (`surface-card`, `surface-line`, `surface-page`), raio `rounded-panel`
- rótulos de campo em `font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground`, que é
  o padrão de "dado de máquina" já usado no `task-form` e nos chips do composer
- foco em `focus-visible:border-accent-primary`, estado sólido em vez de `/opacity`
- **nenhum hex, nenhuma cor arbitrária** — token de `global.css` ou nada

### 5. Os dois fixes de parser

**`Dailify-94y`** — `parse-task.ts`, `parseDuration`. O pareamento prefixo↔conector (`de`↔`ate`,
`das/da`↔`as`) rejeita `"de 14h às 15h"`, e o fallback `explicit` lê `"de 14h"` como duração de 14
horas. A forma irmã `"das 14h até 15h"` é pior: deixa `"call das até 15h"` no título.

A revisão final do branch anterior mediu o fix: forçar o pareamento a aceitar qualquer
prefixo com qualquer conector passa **216/216** testes e muda 3 casos em 347 entradas, os 3
melhorias. O falso positivo que o pareamento supostamente barra (`"jogo de 2 a 3"`,
`"de 15/08 a 16/08"`, `"férias de 10 a 20 de agosto"`) continua barrado pelo conector obrigatório
`as|ate`, que é outra condição.

**`Dailify-xgz`** — `parse-task.ts`, `joinAcrossCut`. Quando o recorte encosta no fim da frase, a
preposição imediatamente à esquerda fica apontando pro nada: `"reunião no meet.google.com/x hoje às
16h"` salva `"reunião no"`.

A limpeza absorve a preposição **apenas** quando ela é adjacente ao span removido e não sobra nada
depois dela. `"comprar pão no mercado hoje"` não pode virar `"comprar pão"` — ali o `"no mercado"`
não foi recortado, e é o mesmo cuidado que já governa a limpeza de pontuação: mexer só na costura
do próprio corte, nunca no texto que o usuário escreveu longe dali.

## Testes

O repo não tem jsdom nem testing-library, então componente React não tem teste — o que tem lógica
é função pura e é testada em vitest.

**`parse-task.test.ts`** — os dois fixes:
- `"call de 14h às 15h"` → 1h às 14:00, título `"call"`; idem `"call das 14h até 15h"`
- os falsos positivos que o pareamento protegia continuam recusados: `"jogo de 2 a 3"`,
  `"de 15/08 a 16/08"`, `"férias de 10 a 20 de agosto"`
- preposição órfã: `"reunião no meet.google.com/x hoje às 16h"` → `"reunião"`; e o
  contra-exemplo `"comprar pão no mercado hoje"` → `"comprar pão no mercado"`

**`functions.test.ts`** — `isTaskModified` detecta mudança em `links` (adicionar, remover, trocar)
e não regride nos campos que já compara.

**`apps/server/test/`** — a suíte inteira roda contra o schema sem `description`: create, edit,
read e o round-trip de `links` seguem verdes; nenhum insert menciona a coluna dropada.

## Fora de escopo

- **Remover a prioridade** — 25 arquivos, incluindo landing e voz. Projeto próprio.
- **Tarefa sem data** (`Dailify-1xr`), **tags via `#`** (`Dailify-yok`), **recorrência no texto**
  (`Dailify-p84`).
- **Rótulo de link vindo da página** (fetch do `<title>` no servidor). O mapa de hostname resolve
  os casos que importam sem rede.
- **Detecção de homoglyph/IDN** nos links — mitigada de lado, porque `linkLabel` exibe o hostname
  já em punycode (`xn--…`), o que denuncia o disfarce.
