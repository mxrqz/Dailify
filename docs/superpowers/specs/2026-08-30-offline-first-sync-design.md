# Offline-first: cache local, fila de mutações e sync LWW

**Data:** 2026-08-30
**Issue bd:** epic offline-first
**Branch:** `worktree-mobile-nav`

## Problema

O app não existe sem rede. Abrir sem conexão dá a tela de erro do navegador; com a aba já aberta,
toda escrita falha na hora e a leitura devolve o mês vazio. Num app de agenda usado no celular —
metrô, elevador, avião, 3G ruim — isso é o modo de uso normal, não a exceção.

O shell Tauri não muda nada aqui: ele hospeda o mesmo webview, então o que resolve no navegador
resolve lá. Não há API nativa envolvida.

## Decisões

### 1. Sem endpoint `/sync`

A fila offline **replica as rotas que já existem** (`POST /tasks`, `PATCH /tasks/:id`,
`POST /tasks/:id/complete`, `DELETE /tasks/:id/complete`, `DELETE /tasks/:id`). Um endpoint de sync
dedicado seria um segundo caminho de escrita, com as mesmas regras de quota e validação escritas
duas vezes — e é exatamente aí que as duas cópias divergem.

O preço: a fila é uma sequência de chamadas, não um lote. Para o volume de um app pessoal (dezenas
de mutações acumuladas no pior caso) isso é irrelevante.

### 2. `updatedAt` + `hash` por tarefa

| campo | tipo | quem escreve |
| --- | --- | --- |
| `updatedAt` | epoch-ms | cliente, a cada mutação |
| `hash` | string (FNV-1a do conteúdo) | derivado, os dois lados calculam |

- **`updatedAt` resolve o conflito.** O servidor compara o `updatedAt` que chega com o que tem: se o
  que chega é mais velho, a escrita é ignorada e o servidor devolve a versão dele. É LWW, como
  pedido: a edição mais recente vence.
- **`hash` evita trabalho.** Mesmo conteúdo = nada a gravar (e nada de `updatedAt` novo por uma
  escrita que não mudou nada). Na fila, ele colapsa edições repetidas da mesma tarefa: só a última
  precisa subir.

`taskHash()` vive em `@dailify/shared` e é a mesma função nos dois lados — se cliente e servidor
calculassem hashes diferentes para o mesmo conteúdo, todo sync viraria uma escrita.

### 3. Idempotência: id do cliente + upsert

O id já é gerado no cliente (`TaskInput.id`). O `INSERT` vira `INSERT ... ON CONFLICT(id) DO UPDATE`,
então **repetir uma mutação da fila não duplica nem estoura**. Isso também fecha o bd `Dailify-7wg`
(id vindo do cliente colidindo com a PK global e gerando 500 cru).

### 4. Clock drift é o furo conhecido do LWW

O `updatedAt` vem do relógio do cliente. Um aparelho adiantado em 10 minutos ganharia toda disputa
até o relógio real alcançá-lo. Mitigação: o servidor recusa `updatedAt` mais de 5 minutos no futuro
e usa o próprio relógio nesse caso. Não é vector clock — é o suficiente enquanto o app for
single-user por conta, e está marcado no código com `ponytail:` apontando o caminho.

### 5. Camadas no cliente

**Correção sobre o rascunho:** não entrou `idb-keyval`. A agenda de um mês são dezenas de KB, muito
abaixo dos 5MB do `localStorage`, e o custo síncrono é ~1ms — dependência nova só se um dia isso
virar histórico inteiro.

```
localStorage
  dailify:tasks:<userId>    → última lista conhecida       (leitura instantânea no boot)
  dailify:outbox:<userId>   → fila FIFO de mutações        (escrita)

boot            → pinta do cache, revalida em background
mutação         → aplica na lista, enfileira, tenta enviar
online/visible  → drena a fila, depois revalida
```

A fila é FIFO e para no primeiro erro **de rede** (a ordem importa: criar antes de editar). Erro de
servidor (400/403/404 — quota, tarefa que não existe mais) descarta a entrada e avisa: retentar pra
sempre uma mutação que o servidor recusa é como a fila entope.

### 6. Shell offline

`vite-plugin-pwa` com `registerType: "autoUpdate"` e `navigateFallback` pro SPA. Sem service worker
o app nem abre sem rede — o resto desta spec seria inalcançável.

## Fora de escopo

- **Multi-device em tempo real.** Sem WebSocket, sem push: o sync acontece ao voltar pro app.
- **CRDT / merge por campo.** Duas edições simultâneas do mesmo campo: a mais recente vence, a outra
  se perde. Documentado, não escondido.
- **Fila de criação por voz.** O áudio é grande e o endpoint é caro; voz continua exigindo rede.
- **De-dup histórico.** Se o banco já tiver duplicatas de antes deste trabalho, elas continuam lá —
  a limpeza é um passo à parte, decidido depois (o usuário pediu explicitamente pra deixar pra
  depois).

## Plano de execução (um commit por camada)

1. `feat(shared+server)`: `updatedAt`, `hash`, `taskHash()`, migration, upsert idempotente, LWW.
2. `feat(web)`: cache local + outbox + drenagem em `online`/`visibilitychange`.
3. `feat(web)`: PWA shell (`vite-plugin-pwa`) + indicador de "sem conexão / N pendentes".
