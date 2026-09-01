# Quotas reais: registro único, limites numéricos em todos os planos e medidor no header

**Data:** 2026-08-31
**Issue bd:** `Dailify-5v4`
**Branch:** `worktree-frontend`

## Problema

O pedido original era mostrar no header quanto o usuário ainda tem de tarefas, recorrentes e IA.
A investigação achou três problemas maiores que a UI.

### 1. Só existe uma quota numérica

`PLAN_PERMISSIONS` (`packages/shared/src/pricing.ts`) hoje:

| | free | pro | pro+ai |
| --- | --- | --- | --- |
| `taskLimits.monthly` | 30 | 300 | -1 |
| `taskLimits.recurring` | **0** | **-1** | **-1** |
| `features.voiceCreation` | **false** | **false** | **true** |

Recorrentes e voz são booleanos disfarçados — nunca um número finito positivo. Não há o que
preencher numa barra: são "liberado/bloqueado".

### 2. A voz é preço fixo sobre custo variável, sem teto de verdade

- `gpt-4o-mini-transcribe` cobra **por duração do áudio** (~$0.003/min) — está no comentário em
  `apps/server/src/lib/openai.ts:8`. A geração (`gpt-4o-mini`) é ruído: ~$0.0004/chamada.
- O gravador **não tem limite de duração** (`apps/web/src/components/wave-form.tsx:92-99`), grava
  a 24 kbps = 3 KB/s.
- O único teto é `MAX_AUDIO_BYTES = 5 MB` (`apps/server/src/routes/voice.ts:50`), dimensionado
  contra abuso de upload, não contra minuto de fala. 5 MB ÷ 3 KB/s = **~28 minutos de áudio numa
  request**, ou **$0.084**.
- `VOICE_LIMITER` (6/min, `apps/server/wrangler.toml`) segura rajada, não total mensal.

Teto teórico de um Pro+AI: ~$30/hora contra R$ 19,90/mês de receita.

### 3. O conhecimento de quota está espalhado, e já produz mentira

Dez lugares sabem de quota hoje: `pricing.ts` (números e `computeEntitlements`), `types.ts`
(shapes), `db/limits.ts` (enforcement), `db/tasks.ts` (contadores), `routes/voice.ts` (gate),
`routes/billing.ts` (`/permissions`), `useEntitlements.ts` (derivação do uso), `billing.tsx`
(exibição), `plan-cards.tsx` (bullets de venda) e `dashboard/copy.ts` (strings).

O caso concreto é `planFeatures()` (`apps/web/src/components/pricing/plan-cards.tsx:14-23`):

```ts
if (taskLimits.recurring === -1) bullets.push(copy.features.unlimitedRecurrence);
if (features.voiceCreation) bullets.push(copy.features.voiceCreation);
```

Com a tabela nova (free = 3 recorrentes, pro = 30), **só `-1` gera bullet** — a página de preços
pararia de anunciar recorrência no free e no pro. Entregaríamos uma feature que a vitrine não
menciona, sem erro nenhum, em tempo de compilação ou de execução.

Levantamento em repositórios públicos confirma que o campo-nomeado-por-quota é o padrão comum e que
ele apodrece: o `IQuotas` do VS Code (`chat`, `completions`, `premiumChat`, `sessionRateLimit`,
`weeklyRateLimit`) repete `mergeDefinedSnapshot` uma vez por quota.

## Decisões

### 1. Um registro único de quotas em `@dailify/shared`

Toda quota é declarada uma vez, e todo o resto itera sobre a declaração:

```ts
export const QUOTAS = {
  tasks:     { scope: "month",    limits: { free: 30, pro: 300, "pro+ai": -1,  admin: -1 } },
  recurring: { scope: "lifetime", limits: { free: 3,  pro: 30,  "pro+ai": -1,  admin: -1 } },
  voice:     { scope: "month",    limits: { free: 3,  pro: 5,   "pro+ai": 200, admin: -1 } },
} as const;

export type QuotaKey = keyof typeof QUOTAS;
```

Derivação única, genérica na chave:

```ts
export interface QuotaState {
  limit: number;        // -1 = ilimitado
  used: number;
  remaining: number;    // Infinity quando ilimitado
  unlimited: boolean;
  blocked: boolean;     // limit === 0
  exhausted: boolean;   // remaining === 0
  ratio: number | null; // null = ilimitado (sem fração possível); 1 quando blocked
}
```

`ratio` carrega sozinho a decisão de renderização (decisão 6): `null` vira `value={null}` no Radix.

**As pontas do registro:**

- **Servidor**: `Record<QuotaKey, contador>`. Contador faltando é **erro de compilação**.
- **Web**: `Record<QuotaKey, rótulo>` em `dashboard/copy.ts`. Rótulo faltando é **erro de
  compilação**. Números moram no `shared`, palavras moram na web — o tipo amarra os dois.

Adicionar uma quota passa a ser duas edições, ambas cobradas pelo compilador, em vez de oito
lugares e torcida. `PLAN_PERMISSIONS` e `features.voiceCreation` deixam de existir: voz vira uma
quota como as outras, onde `0` significa bloqueado.

**Isto não é um framework de quotas.** É um objeto literal e duas funções puras. `scope` tem
exatamente os dois valores que existem hoje.

### 2. Os escopos não são iguais, e o registro diz isso em voz alta

| quota | escopo | por quê |
| --- | --- | --- |
| `tasks` | `month` | `countMonthlyTasks` conta o mês **da data da tarefa**, não o da criação. Uma agenda de agosto tem 30 vagas; setembro tem outras 30. |
| `voice` | `month` | Mês-calendário, o mês em que o comando foi dado. |
| `recurring` | `lifetime` | `countRecurringTasks` conta toda recorrente que existe, sem noção de fim. |

Consequência: `/permissions` precisa do mês (`?month=YYYY-MM`) para responder as quotas `month`. O
cliente já refaz o fetch de tarefas ao trocar de mês; o de permissões acompanha.

O escopo `lifetime` de `recurring` era acidental (com limite `0` nunca importou). Declará-lo torna
`Dailify-v3e` — recorrente antiga ocupando vaga para sempre — uma escolha explícita, não um bug
descoberto depois.

### 3. A unidade da cota de IA é o comando, e o comando é capado em 60s

Contar requests só é honesto se as requests custarem parecido. Hoje variam **56×** ($0.0015 a
$0.084). Então o cap vem primeiro e a contagem depois:

- **Client** (`wave-form.tsx`): para de gravar em 60s. É **só UX** — impede o usuário honesto de
  falar 10 minutos e perder tudo num 413.
- **Server** (`voice.ts`): `MAX_AUDIO_BYTES` de 5 MB → **512 KB**. Isso é o enforcement. 60s a
  24 kbps = 180 KB; 512 KB dá folga pro AAC do Safari, que comprime pior que Opus.

Alternativas descartadas:

- **Medir segundos de verdade.** `gpt-4o-mini-transcribe` só devolve `json`/`text`; `verbose_json`
  com `duration` é do `whisper-1`, que custa 2×. Derivar dos bytes é estimativa que o client
  controla (ele escolhe o bitrate). Mandar a duração pelo client é confiar no client.
- **Contar tasks criadas por voz.** Comando ≠ task: um comando cria 3 tasks, ou zero — `type:
  "list"` e `type: "invalid"` não criam nada e mesmo assim pagaram a transcrição.

**Furo conhecido, aceito:** byte é proxy de duração, não duração. Uma request forjada pode encodar
~8 min a 8 kbps dentro de 512 KB → $0.026 em vez de $0.003. O que fecha a conta não é o cap
sozinho, é cap **+** cota: 200 comandos × $0.026 (pior caso) = $5.20/mês contra R$ 19,90. Abaixo de
8 kbps a transcrição vira lixo, então o ataque não escala. Marcar com `ponytail:` no código.

### 4. Todos os planos têm todas as features, em limites crescentes

| | free | pro | pro+ai |
| --- | --- | --- | --- |
| tarefas/mês | 30 | 300 | ∞ |
| recorrentes | 3 | 30 | ∞ |
| voz/mês | 3 | 5 | 200 |

Custo de IA por usuário/mês: free $0.009, pro $0.015, pro+ai $0.60.

**Trade-off comercial assumido:** hoje a voz é o único diferencial do `pro+ai` sobre o `pro`. Dando
voz ao free, deixa-se de vender "desbloqueie a voz" e passa-se a vender "mais voz", que converte
pior. Em troca, o free experimenta a feature que vende o produto. A distância pro→pro+ai (5 → 200,
40×) é o que mantém o upgrade óbvio.

**Sem grandfathering.** Recorrentes cai de ∞ para 30 no pro, o que rebaixaria assinante ativo — mas
não há assinantes ainda. A janela para fazer isso de graça é agora.

### 5. O uso das três quotas vem do servidor

Hoje o cliente conta tarefas sozinho, do array que já baixou (`useEntitlements`), e voz ele não tem
como contar — não sobra registro nenhum no que ele recebe. Manter os dois jeitos seria manter o
espalhamento que a decisão 1 remove.

`/permissions` passa a devolver `{ limits, usage }`, ambos `Record<QuotaKey, number>`, serializados
genericamente. A contagem local morre — **e com ela o bug do "0/30"**, que hoje aparece sempre que
o mês não carregou (offline, erro de rede) porque `tasks` é `undefined` e `new Set([]).size` é 0.

Armazenamento: só `voice` precisa de tabela; `tasks` e `recurring` saem de `SELECT COUNT(*)` sobre
`tasks`. A tabela é genérica — `usage(user_id, quota, period, count)` — porque é o mesmo SQL de uma
tabela específica e evita uma migration por quota futura.

**Momento do incremento:** depois de `transcribe()` retornar, antes de `generateTasks()`. É o ponto
onde o dinheiro saiu. Se a geração falhar depois, o comando já custou e tem que contar.

**Reconciliação:** o cliente incrementa o próprio contador de forma otimista ao criar (mesmo lugar
onde a tarefa já entra otimista, `home.tsx:108`), e o próximo `/permissions` reconcilia. Sem isso a
barra só se moveria no refetch.

### 6. As três barras aparecem sempre, com três estados distintos

O padrão da indústria para ilimitado é **esconder a barra** (o GitLab chama de "no-limit-hide-bar").
Aqui elas ficam sempre visíveis, então o ilimitado precisa de estado próprio — não pode virar 0%
nem 100%, senão mente:

| estado | barra | número |
| --- | --- | --- |
| finito | preenche `used/limit` | `12/30` |
| ilimitado (`-1`) | trilho vazio (`ratio === null` → Radix `value={null}` → `data-state="indeterminate"`) | `47/∞` |
| bloqueado (`0`) | trilho **cheio** | `0/0` |

Bloqueado como cheio não é truque: "cheio" já significa "não pode mais", que é exatamente o caso.
Nenhum plano da decisão 4 tem `0`, mas o modelo permite e precisa degradar honesto.

**Componente:** `<meter>` é o elemento semanticamente correto (medição escalar num intervalo;
`<progress>` é conclusão de tarefa), mas o suporte de `role="meter"` em leitor de tela é pior que o
de `progressbar` e estilizá-lo exige pseudo-elemento por browser. Fica o `<Progress>` do Radix que
já está instalado e já é usado em `billing.tsx`, com `aria-label` dizendo o que a barra realmente é.

Vertical foi descartada por geometria: o header é `h-10` fixo e `home.tsx` desconta esse valor —
uma bateria vertical teria ~16 px de curso, 0,5 px por tarefa no plano free.

**Layout — provisório, a refinar depois:** três pares ícone + barra em linha (~48 px cada, ~150 px
no total), número exato no `title` nativo. Não há componente de Tooltip em `ui/` e não vale instalar
um pra isso. O `SyncBadge` só renderiza offline ou com fila pendente (`sync-badge.tsx:23`), então na
maior parte do tempo não disputa largura. O grupo inteiro é `hidden md:flex`: no mobile a Brand é
`absolute left-1/2` e não sobra espaço.

A cor: o número vira `text-destructive` quando `exhausted`. **A barra não muda de cor** —
`--primary` já é o vermelho da marca e ficaria indistinguível.

## Riscos

### `countRecurringTasks` não sabe o que é "encerrada"

`SELECT COUNT(*) ... WHERE repeat_kind != 'Off'` (`apps/server/src/db/tasks.ts:142`) conta toda
recorrente que existe. Uma recorrente criada em 2024 ocupa um dos 3 slots do free para sempre. Com
limite `0` isso nunca importou; com limite `3`, importa. A decisão 2 declara isso como
`scope: "lifetime"` em vez de deixar acidental. Correção fora do escopo: `Dailify-v3e`.

### A migração de shape do `/permissions` é quebrante

O endpoint devolve `Permissions` cru hoje e passa a devolver `{ limits, usage }`. Web e server
deployam juntos e permissões não são cacheadas offline (`protected-route.tsx:48` busca fresco;
`undefined` = loading), então não há cliente antigo para acomodar.

## Arquivos

| # | arquivo | mudança |
| --- | --- | --- |
| 1 | `packages/shared/src/quotas.ts` **(novo)** | `QUOTAS`, `QuotaKey`, `QuotaState`, `limitsFor(role)`, `quotaState(limit, used)`. |
| 2 | `packages/shared/src/pricing.ts` | `PLAN_PERMISSIONS` sai (vira `limitsFor`). `computeEntitlements` vira genérico na chave. `PLAN_PRICING` e o resto ficam. |
| 3 | `packages/shared/src/types.ts` | `Permissions`/`Entitlements` viram `Record<QuotaKey, …>`. `features.voiceCreation` some. |
| 4 | `apps/server/migrations/0007_usage.sql` | `usage(user_id TEXT, quota TEXT, period TEXT, count INTEGER NOT NULL DEFAULT 0)`, `PRIMARY KEY(user_id, quota, period)`, incremento por `ON CONFLICT DO UPDATE`. |
| 5 | `apps/server/src/db/limits.ts` | `COUNTERS: Record<QuotaKey, contador>` e um `enforce(key)` genérico. `enforceCreate` passa a chamá-lo para `tasks` e, se recorrente, `recurring`. |
| 6 | `apps/server/src/routes/voice.ts` | `MAX_AUDIO_BYTES` → 512 KB; `enforce("voice")` antes; incremento depois de `transcribe`. O gate por `features.voiceCreation` some (vira `blocked`). |
| 7 | `apps/server/src/routes/billing.ts` | `/permissions?month=` devolve `{ limits, usage }`. |
| 8 | `apps/web/src/functions/api.ts` | `getPermissions` acompanha o novo shape e passa o mês. |
| 9 | `apps/web/src/components/dailifyContext.tsx` + `hooks/useEntitlements.ts` | Carregar `usage` do servidor; a contagem local de tarefas some. |
| 10 | `apps/web/src/components/wave-form.tsx` | Para de gravar em 60s. |
| 11 | `apps/web/src/components/quota-bar.tsx` **(novo)** + `app-header.tsx` | O medidor, iterando `QUOTAS`. |
| 12 | `apps/web/src/pages/billing.tsx` | A seção de uso itera `QUOTAS` em vez de falar só de tarefas. |
| 13 | `apps/web/src/components/pricing/plan-cards.tsx` | `planFeatures()` itera `QUOTAS` — o `if` por quota some, e com ele a mentira do problema 3. |
| 14 | `apps/web/src/components/dashboard/copy.ts` | `Record<QuotaKey, rótulo>` + templates de bullet finito/ilimitado. |

## Testes

- **`packages/shared`**: `quotaState` nos três estados (finito, `-1`, `0`) e nas bordas
  (`used > limit`, `used === 0`). `limitsFor` para os quatro papéis.
- **`apps/server`**: `enforce` no limite e além, por quota; o incremento acontece uma vez por
  comando; `POST /voice` recusa 513 KB; `/permissions` responde o mês pedido.
- **`apps/web`**: `planFeatures()` gera bullet de recorrência para free e pro — o teste que teria
  pego o problema 3. A regra de visibilidade/estado do `quota-bar` como função pura.

O teste de preço existente (`apps/server/test/pricing-stripe.test.ts`) não é afetado: os limites
mudam, os preços não.
