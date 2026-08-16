# Composer de campo único — extrair data, duração e links do texto

**Data:** 2026-08-14
**Branch:** `worktree-task-edit-sidebar`
**Fecha:** `Dailify-0do`
**Encosta em:** `Dailify-1xr` (tarefa sem data), `Dailify-yok` (tags via `#`), `Dailify-p84` (recorrência)

## Problema

O composer tem dois campos: "quando" em linguagem natural e o texto da tarefa
(`task-composer.tsx:63-98`). O usuário separa à mão uma coisa que ele já sabe dizer numa frase só —
"reunião com o time hoje às 16:30" vira uma viagem de ida e volta entre dois inputs.

E o que o composer produz é pobre. `composerTaskInput` (`home.tsx:43-56`) monta a tarefa com
`duration: "10m"` fixo, `priority: 0` e `description: ""`. Toda tarefa criada por ali dura dez
minutos porque ninguém nunca perguntou — e uma reunião de uma hora nasce igual a um lembrete de
tomar remédio.

Links não existem em lugar nenhum. Uma tarefa "reunião" cujo Meet está no calendário obriga o
usuário a sair do app pra achar a sala. O dado mais acionável da tarefa é justamente o que o
modelo não guarda.

## Decisões

Fechadas no brainstorm, com o racional:

**Um campo de texto, campos derivados.** O composer continua burro: recebe uma frase. Tudo que é
estruturado — data, duração, links — sai dela por extração, não por formulário. O usuário nunca
preenche "links"; ele escreve a frase e o link estava lá.

**Texto limpo: o parser recorta o que consumiu.** "reunião das 15 às 16 meet.google.com/abc" vira
`title: "reunião"` + `date` + `duration` + `links`. A alternativa — manter a frase inteira no
título e só derivar os campos — duplicaria cada informação em dois lugares, e o painel de edição
mostraria o horário como campo *e* dentro do texto. Cada dado num lugar só.

**Extração é one-shot, na criação.** Depois que a tarefa existe, texto e campos são editados
separadamente, cada um dono do que é seu. O parser não roda de novo na edição — apagar "às 16h" do
título não mexe na data.

**Link com allowlist curta de TLDs.** Aceita `https://x`, `http://x`, `www.x.com` e domínio nu
(`youtube.com/watch?v=abc`), mas só com TLD de uma lista escrita à mão. O motivo é concreto: `ts` e
`sh` **são** TLDs válidos (Timor-Leste e Santa Helena), então uma lista completa transformaria
"editar o `main.ts`" e "rodar o `deploy.sh`" em link — num app usado por quem escreve isso o dia
todo. A lista curta erra pro lado seguro de propósito.

**`links` é array de URLs, rótulo derivado.** A coluna guarda só as URLs; o rótulo do chip sai do
hostname na hora de renderizar. Nada de rede, nada de buscar `<title>` de página. É JSON num
`TEXT`, então virar `{url, label}` no futuro não custa `ALTER TABLE`.

**Sem trecho temporal, não cria.** Mantém a regra de hoje. "comprar leite" é recusado com um pedido
de quando — e não jogado em "hoje 09:00", que grudaria uma data falsa em toda tarefa sem hora.
Quando `Dailify-1xr` (backlog) existir, esse é o destino natural do caso; até lá, recusar não gera
dado que a feature futura teria que resgatar.

**Motor fica no web.** Cogitei `packages/shared` pro servidor reaproveitar, mas o único outro
criador de tarefa a partir de linguagem natural é a criação por voz, e ela já recebe
`title`/`date`/`duration` estruturados da OpenAI (`apps/server/src/lib/openai.ts:92-98`). Não há
consumidor — mover seria abstrair pra ninguém.

**Fora: tags e recorrência.** `#trabalho` (`Dailify-yok`) e "toda terça" (`Dailify-p84`) são a mesma
ideia e entram depois, com o recorte já de pé. A recorrência ainda carrega um risco próprio: é
feature paga (`PLAN_PERMISSIONS.taskLimits.recurring`), e extração automática precisa passar pelo
gate de plano.

## Design

### 1. O motor

`parse-when.ts` vira `parse-task.ts`: deixa de ser "o parser do campo quando" e passa a ser o parser
da frase. Não é reescrita — as 431 linhas atuais já entendem português de verdade (palavras de hora,
"e meia", dias da semana, meses, "próxima", meridiano, períodos do dia) com 199 linhas de teste em
cima. O que muda é a saída.

```ts
export interface ParsedTask {
  text: string;             // o que sobrou, recortado e com espaços normalizados
  date: Date | null;
  duration: string | null;  // "1h30m" — mesmo formato que o model já usa
  links: string[];          // URLs absolutas, sempre http(s)
}

export function parseTaskText(input: string, now?: Date): ParsedTask;
```

Por dentro são **três detectores independentes** — tempo, duração/intervalo, link. Cada um devolve
`{ value, spans: [[início, fim], …] }` em vez de mexer no texto, e um passo final recorta todos os
spans de uma vez.

São *vários* spans por detector, não um, porque um achado nem sempre é contíguo: o meridiano é
casado separado do horário (`applyMeridiem`, `parse-when.ts:219`), então "amanhã às 9 da noite"
produz um span pra "às 9" e outro pra "da noite". Com um span só, "da noite" sobraria no título.

A razão é operacional: se cada detector recortasse na sua vez, o segundo receberia uma frase
mutilada pelo primeiro e os índices do terceiro apontariam pro lugar errado. Com spans, os três
enxergam o mesmo texto, a ordem entre eles não importa, e cada um é testável sozinho.

**Restrição — a normalização precisa ser 1:1.** O `normalize()` de hoje (`parse-when.ts:168`) não
serve como base pra span: `NFD` + remoção de diacríticos encurta a string, `\s+ → " "` colapsa, e
`trim()` desloca o início. Um span medido no texto normalizado não mapeia de volta pro original.

A saída é normalizar caractere a caractere: minúsculas e remoção de acento preservando um char por
char, hífen/apóstrofo viram espaço (já é 1:1), e **o colapso de espaços e o `trim()` saem**. Eles
são redundantes de qualquer forma — `alternation()` já troca todo espaço literal por `\s+`
(`parse-when.ts:186`), então os padrões toleram espaço múltiplo sozinhos. Com a normalização 1:1, o
span do normalizado *é* o span do original.

### 2. Regras de extração

**Tempo.** É o que `parseDay`/`parseTime` já fazem; ganham o span do trecho que casaram.

**Duração e intervalo.** Duas formas:

| Forma | Exemplo | Vira |
| --- | --- | --- |
| explícita | "de 1h", "30min", "meia hora", "1h30" | `duration` |
| intervalo | "das 15 às 16", "15h-16h", "das 9 às 10:30" | `date` (início) + `duration` |

O intervalo é um achado só — início e duração juntos. **Intervalo tem precedência sobre horário
simples:** sem isso o detector de tempo pega o "15" de "das 15 às 16" e os dois spans se sobrepõem.
Regra geral de desempate entre spans que colidem: vence o mais longo.

Sem nenhuma das duas formas, `duration` volta `null` e o composer aplica o `"10m"` de hoje.

**Link.** Um candidato é qualquer token sem espaço que case com forma de URL. Passa se:

1. tem esquema `http://` ou `https://`; **ou**
2. começa com `www.`; **ou**
3. tem forma `host.tld[/path]` com o TLD na allowlist.

```ts
// Curta de propósito: `ts`, `sh`, `py`, `rs`, `go`, `md` são TLDs reais e extensões de arquivo.
// Ficam de fora — errar pro lado de não-é-link é o certo aqui.
const TLDS = ["com", "br", "org", "net", "io", "dev", "app", "me", "gg", "co", "ai", "xyz"];
```

A allowlist mora numa const no próprio `parse-task.ts` com um comentário dizendo por que é curta —
senão a primeira pessoa que "corrigir" pra lista IANA completa reintroduz o bug do `main.ts`.

Normalização acontece aqui: o que sai do detector é **sempre URL absoluta com esquema**
(`youtube.com/watch` → `https://youtube.com/watch`). Assim o que trafega e o que fica no banco tem
uma forma só, e o servidor não precisa adivinhar nada.

Pontuação final grudada (`"…veja youtube.com/abc."`) é aparada do fim do candidato antes da
validação — `.`, `,`, `;`, `)` e `]` não fazem parte da URL nesse contexto.

### 3. O composer

Os dois campos viram um `textarea`. O eco em mono que hoje fica ao lado do campo "quando" vira uma
linha de chips embaixo, mostrando tudo que o parser tirou da frase, atualizando a cada tecla — o
`useMemo` de hoje (`task-composer.tsx:36`) já tem essa forma.

```
┌──────────────────────────────────────────────┐
│ Reunião com o time das 15 às 16              │
│ meet.google.com/abc-defg                     │
│                                          [↑] │
├──────────────────────────────────────────────┤
│  QUI · 14 AGO · 15:00   1h   ▸ Google Meet   │
└──────────────────────────────────────────────┘
```

O eco deixa de ser enfeite e vira a explicação do botão: **sem data reconhecida o botão fica
desabilitado**, e o chip de data mostra o que falta. Hoje o "não entendi" só aparece como toast
depois do envio; com um campo só, errar em silêncio até o submit é pior, porque o usuário não sabe
qual pedaço da frase o parser não engoliu.

Dois casos de recusa, mesmo tratamento:

- **sem data** — nenhum trecho temporal reconhecido
- **sem texto** — "hoje às 16h" sozinho: o parser consome a frase inteira, `text` volta vazio e a
  tarefa nasceria sem título

O resto fica como está: Enter envia, Shift+Enter quebra linha, limpa ao enviar. Strings novas vão
pro `dashboard/copy.ts`, sem literal no JSX.

`composerTaskInput` (`home.tsx:43-56`) passa a receber o `ParsedTask` inteiro em vez de montar a
tarefa a partir de dois pedaços. `priority: 0` e `description: ""` continuam ali — tirar a
prioridade de vez é do próximo spec.

### 4. Dados e servidor

`links` copia exatamente o caminho que `tags` já faz — nenhum padrão novo:

```
migration 0002:  ALTER TABLE tasks ADD COLUMN links TEXT;
shared:          TaskInput/Task ganham  links?: string[]
db/tasks.ts:     JSON.parse na leitura (:40), JSON.stringify na escrita (:63, :157), null quando vazio
```

**Validação na rota, não só no cliente.** O painel de edição vai renderizar esses links como
`<a href>` clicável, e o servidor é a fronteira de confiança. Nada impede um POST direto com
`links: ["javascript:alert(document.cookie)"]`, que viraria um link clicável na tela do próprio
usuário. Então em `routes/tasks.ts`:

- só `http:` e `https:` passam — `URL.canParse` + checagem de protocolo, nativo no Workers
- **cap de 10 links** por tarefa, pra um array não virar payload arbitrário

O rótulo do chip é puro render: mapa `hostname → nome` (`meet.google.com` → "Google Meet",
`youtu.be`/`youtube.com` → "YouTube", `github.com` → "GitHub"), com fallback pro próprio hostname.
Não vai pro banco, não faz rede.

### 5. Arquivos

| Arquivo | O quê |
| --- | --- |
| `apps/web/src/functions/parse-task.ts` | renomeado de `parse-when.ts`; normalização 1:1, spans, detectores de duração e link |
| `apps/web/src/functions/parse-task.test.ts` | renomeado; os 199 existentes seguem valendo + os novos |
| `apps/web/src/components/dashboard/task-composer.tsx` | dois campos → um; chips do eco |
| `apps/web/src/components/dashboard/copy.ts` | placeholder e mensagens novas |
| `apps/web/src/pages/home.tsx` | `composerTaskInput` recebe `ParsedTask` |
| `packages/shared/src/types.ts` | `links?: string[]` em `Task`/`TaskInput` |
| `apps/server/migrations/0002_links.sql` | `ADD COLUMN links TEXT` |
| `apps/server/src/db/tasks.ts` | serialização, igual `tags` |
| `apps/server/src/routes/tasks.ts` | validação http(s) + cap de 10 |

## Testes

Tudo que tem lógica é função pura, então é vitest sem jsdom — o repo não tem testing-library, e é
justamente por isso que o motor não pode virar estado de componente.

**`parse-task.test.ts`** (web) — os 199 casos atuais continuam válidos e ganham:

- span: o recorte devolve o texto certo, inclusive com acento antes e depois do trecho (é o teste que
  pega a normalização 1:1 quebrada)
- intervalo: "das 15 às 16" → início 15:00 + `1h`, e o título fica só "reunião"
- precedência: intervalo vence horário simples; span mais longo vence na colisão
- link: os três caminhos de aceitação, normalização pra absoluta, pontuação final aparada
- link recusado: `main.ts`, `deploy.sh`, `index.html`, "2.5kg de arroz"
- recusa: frase sem tempo → `date: null`; frase só de tempo → `text` vazio

**`apps/server/test/`** — links inválidos (`javascript:`, `data:`, string solta) são rejeitados pela
rota; array acima de 10 é rejeitado; round-trip de `links` sobrevive a create → read → update.

## Fora de escopo

- **O painel de edição** — abrir direto em edição, prioridade fora (campo + tokens de cor),
  título/descrição fundidos com migration de dados, chips de link editáveis por clique, e o passe
  visual da sheet. É o próximo spec, e depende deste pra ter link o que exibir.
- **Tags via `#`** (`Dailify-yok`) e **recorrência** (`Dailify-p84`).
- **Tarefa sem data** (`Dailify-1xr`) — até lá, frase sem tempo é recusada.
- **Rótulo de link vindo da página** (fetch do `<title>` no servidor + cache). O mapa de hostname
  cobre os casos que importam sem rede.
- **Dropar a coluna `priority`** — ela fica com o `DEFAULT 0` até o painel parar de usá-la.
