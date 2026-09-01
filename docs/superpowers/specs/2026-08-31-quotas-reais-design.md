# Quotas reais: limites numéricos em todos os planos + medidor no header

**Data:** 2026-08-31
**Issue bd:** `Dailify-5v4`
**Branch:** `worktree-frontend`

## Problema

O pedido original era mostrar no header quanto o usuário ainda tem de tarefas, recorrentes e IA.
A investigação achou dois problemas maiores que a UI:

### 1. Só existe uma quota numérica

`PLAN_PERMISSIONS` (`packages/shared/src/pricing.ts`) hoje:

| | free | pro | pro+ai |
| --- | --- | --- | --- |
| `taskLimits.monthly` | 30 | 300 | -1 |
| `taskLimits.recurring` | **0** | **-1** | **-1** |
| `features.voiceCreation` | **false** | **false** | **true** |

Recorrentes e voz são booleanos disfarçados — nunca um número finito positivo. Não há o que
preencher numa barra: são "liberado/bloqueado", que o botão **Assinar** já comunica.

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

## Decisões

### 1. A unidade da cota de IA é o comando, e o comando é capado em 60s

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

### 2. Todos os planos têm todas as features, em limites crescentes

| | free | pro | pro+ai |
| --- | --- | --- | --- |
| tarefas/mês | 30 | 300 | ∞ |
| recorrentes | 3 | 30 | ∞ |
| voz/mês | 3 | 5 | 200 |

Custo de IA por usuário/mês: free $0.009, pro $0.015, pro+ai $0.60.

**Trade-off comercial assumido:** hoje a voz é o **único** diferencial do `pro+ai` sobre o `pro`.
Dando voz ao free, deixa-se de vender "desbloqueie a voz" e passa-se a vender "mais voz", que
converte pior. Em troca, o free experimenta a feature que vende o produto. A distância pro→pro+ai
(5 → 200, 40×) é o que mantém o upgrade óbvio.

### 3. A contagem de voz mora em D1, e é a única opção

Não há tabela de usuários (Clerk é a fonte); `publicMetadata` não é transacional; derivar de tasks
não funciona (decisão 1). Sobra uma tabela nova.

Chave `(user_id, month)` com `month` em `'YYYY-MM'` — **mês-calendário**, para bater com o que
`countMonthlyTasks` já faz (`startOfMonthMs`/`endOfMonthMs` da data da task). Sem limpeza de linhas
antigas: uma linha por usuário por mês é nada, e o cron existente tem outra função.

**Momento do incremento:** depois de `transcribe()` retornar, antes de `generateTasks()`. É o ponto
onde o dinheiro saiu. Se a geração falhar depois, o comando já custou e tem que contar.

### 4. O client não consegue contar voz sozinho

Tasks ele conta do array que já baixou (`useEntitlements`). Voz não deixa registro nenhum no que o
client recebe. Então `/permissions` (`apps/server/src/routes/billing.ts:22`) passa a devolver uso
junto com permissões — sem isso a barra da IA não tem número.

Mudança de shape: hoje o endpoint devolve `Permissions` cru. Passa a devolver
`{ permissions, usage: { voice: number } }`. Web e server deployam juntos e permissions não é
cacheado offline (`protected-route.tsx:48` busca fresco; `undefined` = loading), então não há
versão antiga do client para acomodar.

### 5. O medidor no header é horizontal, e some quando não tem o que dizer

Vertical foi descartada por geometria: o header é `h-10` fixo e `home.tsx` desconta esse valor —
uma bateria vertical teria ~16 px de curso, 0,5 px por task no plano free.

`apps/web/src/components/quota-bar.tsx`, novo:

- Reusa o `<Progress>` que já existe (`ui/progress.tsx`, o mesmo do billing), `h-1 w-12`. Sem CSS
  novo, sem token novo.
- Número em mono `text-2xs` ao lado — mesma tipografia do botão Assinar. Vira `text-destructive`
  quando `remaining === 0`. **A barra não muda de cor**: `--primary` já é o vermelho da marca e
  ficaria indistinguível.
- **Não renderiza** quando o limite é ilimitado, quando ainda está carregando, ou quando o número
  que preencheria a barra não é confiável. Esse último caso é diferente para cada barra: a de
  tarefas depende de `tasks !== undefined` (com o mês não carregado — offline, erro de rede — hoje
  mostraria "0/30" mentindo); a de voz depende de `usage` ter vindo do servidor, já que o client não
  tem como derivá-la sozinha (decisão 4).
- Envolvido em `<Link to="/premium">`: quem vê o limite apertando clica e assina.
- Em `app-header.tsx`, no grupo `ml-auto`, antes do `<SyncBadge />`. `hidden md:flex` — no mobile a
  Brand é `absolute left-1/2` e não sobra largura.
- Tooltip via `title` nativo. Não há componente Tooltip em `ui/` e não vale instalar um pra isso.

Duas barras: tarefas e voz. Recorrentes fica fora do header — é o limite que o usuário encosta uma
vez e esquece; ele aparece no `/premium` e no erro de criação.

Orçamento de largura: cada barra custa ~70 px (12 de barra + o número), então duas somam ~140 px num
header que já tem `SyncBadge` e `Assinar`. No free as duas aparecem juntas; no pro+ai a de tarefas
some (ilimitada) e sobra só a de voz. Se ficar apertado em telas médias, a saída é mostrar **só a
barra mais próxima do limite** e jogar a outra no tooltip — não encolher as duas.

## Riscos

### Rebaixamento de quem já paga

`recurring` é **ilimitado no pro hoje**. Passar a 30 é uma redução para assinantes ativos. Ou
grandfathering, ou aceitar que 30 é alto o bastante pra ninguém encostar. **Decisão: aceitar** — o
número foi escolhido para não ser alcançado; se algum usuário passar, vira suporte, não bug.

### `countRecurringTasks` não sabe o que é "encerrada"

`SELECT COUNT(*) ... WHERE repeat_kind != 'Off'` (`apps/server/src/db/tasks.ts:142`) conta toda
recorrente que existe, sem noção de fim. Uma recorrente criada em 2024 ocupa um dos 3 slots do free
para sempre. Com limite `0` isso nunca importou; com limite `3`, importa. Fora do escopo desta
mudança — está em `Dailify-v3e`.

## Arquivos

| # | arquivo | mudança |
| --- | --- | --- |
| 1 | `packages/shared/src/types.ts` | `features.voiceCreation: boolean` → `taskLimits.voice: number`. `Entitlements` ganha `voiceUsed`/`voiceRemaining`/`voiceLimit`; `voice: boolean` sobrevive como derivado (`voiceLimit !== 0`) para não quebrar o gating existente. |
| 2 | `packages/shared/src/pricing.ts` | A tabela da decisão 2. `computeEntitlements` passa a receber uso de voz. `-1` já é a convenção de ilimitado, então recorrentes 3/30/∞ entra sem mudar o modelo. |
| 3 | `apps/server/migrations/0007_voice_usage.sql` | `voice_usage(user_id TEXT, month TEXT, count INTEGER NOT NULL DEFAULT 0)`, `PRIMARY KEY(user_id, month)`, incremento por `ON CONFLICT DO UPDATE`. |
| 4 | `apps/server/src/db/limits.ts` | `enforceVoice()`: lê a cota, compara, devolve erro. `enforceCreate` não muda — `recurring !== -1` já cobre 3 e 30. |
| 5 | `apps/server/src/routes/voice.ts` | `MAX_AUDIO_BYTES` → 512 KB; `enforceVoice` antes; incremento depois de `transcribe`. |
| 6 | `apps/server/src/routes/billing.ts` | `/permissions` devolve `{ permissions, usage }`. |
| 7 | `apps/web/src/functions/api.ts` | `getPermissions` acompanha o novo shape. |
| 8 | `apps/web/src/components/dailifyContext.tsx` + `hooks/useEntitlements.ts` | Carregar e propagar o uso de voz. |
| 9 | `apps/web/src/components/wave-form.tsx` | Para de gravar em 60s. |
| 10 | `apps/web/src/components/quota-bar.tsx` + `app-header.tsx` | O medidor. |
| 11 | `apps/web/src/pages/billing.tsx` | A seção de uso ganha voz e recorrentes ao lado de tarefas. |

## Testes

- `packages/shared`: `computeEntitlements` com voz — plano sem voz, voz esgotada, ilimitado,
  `permissions === undefined`.
- `apps/server`: `enforceVoice` no limite e além; incremento acontece uma vez por comando;
  `POST /voice` recusa 513 KB.
- `apps/web`: a regra de visibilidade do `quota-bar` como função pura — os três casos em que não
  renderiza.

O teste de preço que já existe (`apps/server/test/pricing-stripe.test.ts`) não é afetado: os
limites mudam, os preços não.
