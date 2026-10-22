# Criação de tarefas + coluna "Sem data": design

> 2026-10-21 · brainstorm com o mxrqz · mockups em `.superpowers/brainstorm/895945-1792626916/content/`
> (`direcoes.html`, `hibrido.html`, `hibrido-v2.html`). Relacionados: Dailify-1xr (tarefa sem data),
> Dailify-p84 (recorrência no texto), Dailify-dgb (microinterações), Dailify-1kz (offline-first).

## Por quê

O composer funciona, mas uma pílula sozinha no meio da tela deixa o app com cara de vazio e
"simplório" para um app de tarefas. E faltam dois usos reais: **despejar coisas sem compromisso de
quando** (braindump, lembrete opcional) e **"toda quarta"** virar recorrência. O objetivo é uma tela
de repouso limpa, criação perto do dedo, e um lugar natural para afazeres sem horário.

## Regra central: o horário decide o destino

| Entrada | Destino | Comportamento |
| --- | --- | --- |
| Com horário ("reunião qui 16h") | Lista do dia | Agenda, como hoje. |
| Sem horário ("comprar pão") | Coluna **Sem data** | Afazer; fica até ser concluído. |
| Sem horário, com dia ("pagar boleto qui") | Sem data | O dia vira **lembrete** (notificação). Não aparece em lista de dia. |
| Recorrente sem horário ("regar plantas toda quarta") | Sem data, seção **Recorrentes** no topo | Ver "Recorrentes sem horário". |
| Recorrente com horário | Lista do dia | Como hoje. |

Não existe "dia inteiro" na lista do dia: **só entra na lista do dia o que tem horário.**

## Recorrentes sem horário

- Ficam no topo da coluna Sem data, numa seção própria.
- Ao marcar, **ficam concluídas até o período virar**; depois voltam desmarcadas.
- Semanal: o período vira no **primeiro dia da semana do usuário, às 06:00** (fuso do usuário), não
  à meia-noite. Ex.: semana começa domingo → marcada de domingo 06:00 até o domingo seguinte 06:00.
- *Minha decisão:* diária vira às 06:00 do dia seguinte; mensal, dia 1 às 06:00; anual, 1º de
  janeiro às 06:00.
- O dia citado ("toda **quarta**") vira lembrete recorrente naquele dia; não muda o período, que é
  sempre a semana. Com vários dias ("segunda e sexta", "dias úteis") continua **uma marcação por
  semana** (decidido pelo mxrqz); cada dia citado só gera lembrete.
- **Histórico:** mostrar os dias em que foi marcada desde a criação (faixa de pontos ou heatmap; o
  visual fica para o design final). O dado já existe: `Task.completed: number[]`.
- "Concluída no período atual" é derivável de `completed` + início do período; *minha decisão:* não
  precisa de job no servidor.

## Configuração: primeiro dia da semana

Nova preferência do usuário (domingo … sábado), escolhida em Configurações. *Minha decisão:* guardada
no servidor para valer em todos os devices; default **segunda** (pt-BR). Afeta a virada das
recorrentes sem horário e, por coerência, a week-strip e o mini-calendário.

## Layout

**Desktop**
- Tela de repouso: só a lista do dia. O composer some do centro.
- **Puxador** na borda direita, centralizado na vertical, **mais alto que largo (proporção 3:4)**,
  metade para fora da tela. *Minha decisão:* mostra a contagem de pendentes Sem data.
- Clicar abre a **coluna Sem data como coluna do layout** (não drawer, não sobrepõe): ela entra
  animando e a lista do dia encolhe. O puxador acompanha a borda da coluna e fecha (*minha decisão*).
- *Minha decisão:* arrastar uma tarefa da coluna para um dia/horário a agenda.

**Mobile**
- Sem data é **outra tela**, alcançada por **swipe horizontal** a partir da tela do dia. Indicador de
  página embaixo (*minha decisão*).
- O swipe das tarefas (completar/excluir, `swipe-actions.tsx`) precisa conviver com o swipe de tela:
  gesto que começa sobre um card é do card; da borda/área vazia, é da tela (*minha decisão*, ajustar
  no teste em device).

**Criação (desktop e mobile)**
- **Botão flutuante "+"** no canto inferior direito.
- Toque (ou atalho `N` no desktop, *minha decisão*) abre a **folha de criação**; no mobile ela sobe
  colada ao teclado. *Minha decisão:* a folha nasce do próprio botão (morph, ver Dailify-dgb).
- Na folha: texto livre; o parser destaca os trechos reconhecidos e os transforma em **etiquetas**
  (data, hora, recorrência, lembrete, duração) enquanto você digita.
- **Corrigir o parser** (*minha decisão*): tocar numa etiqueta edita o valor; remover a etiqueta
  devolve o trecho ao título como texto literal.
- Na tela/coluna Sem data, o "+" cria já sem data.
- Microfone na folha quando a voz voltar (Dailify-2gb).

## Parser

Estender `apps/web/src/functions/parse-task.ts` (regex próprio, com testes), não trocar por lib.
Novo: recorrência — "toda quarta", "todas as segundas e sextas", "todo dia", "dias úteis",
"todo mês dia 5", "todo ano"; mapeia para o `Repeat` de `@dailify/shared`. Sem horário + dia →
lembrete, não data.

## Restrições conhecidas (código atual)

- `tasks.date` é `INTEGER NOT NULL` (D1/SQLite) e `Task.date: number` é obrigatório; todo o app assume
  que tarefa tem dia (week-strip, day-list, `GET /tasks?month=`, expansão de recorrência no servidor).
  Tarefa sem data exige migration (SQLite: rebuild da tabela) e um caminho de leitura que traga as
  Sem data independentemente do mês.
- Push (`apps/server/src/db/push.ts`) só dispara para tarefas **não recorrentes**, uma vez
  (`alert_sent`). Lembrete recorrente semanal das Sem data precisa de suporte novo.
- Quotas (`QUOTAS` em `@dailify/shared`): *minha decisão* — tarefa Sem data conta como tarefa, e
  recorrente Sem data conta também na quota de recorrentes, igual às demais.
- Offline-first (Dailify-1kz) vai mexer na mesma camada de dados; o modelo novo deve caber no store
  local e na fila.

## Não-objetivos

- Projetos, listas múltiplas, subtarefas, prioridade nova.
- Visual final (cores, espaçamentos, ícones) — fica para o design final; os mockups são estrutura.
- Voz (depende de Dailify-2gb).

## Anti-objetivos

- Tela de repouso voltar a ficar "vazia com uma pílula no meio".
- Tarefa sem horário aparecendo na lista do dia.
- A virada das recorrentes acontecer à meia-noite ou ignorar o primeiro dia da semana escolhido.

## Decisões complementares (revisão do builder)

Todas *minha decisão*, salvo indicação:

- **Lembrete de tarefa com dia e sem horário:** 09:00 no fuso do usuário (o mesmo `DEFAULT_HOUR` de
  hoje). Recorrente sem dia citado ("todo dia", "todo mês") não tem lembrete, a menos que o usuário
  adicione. Se a recorrente já foi concluída no período, o lembrete daquele período é suprimido.
- **Tarefas antigas** gravadas às 09:00 por falta de horário ficam como estão (não dá para
  distingui-las de um 9h real). A regra vale para o que for criado daqui em diante.
- **Edição:** o form de edição ganha "sem horário". Tirar o horário de uma tarefa datada a move para
  Sem data (o dia vira lembrete); dar horário a uma Sem data a agenda. É o caminho do mobile para
  agendar, já que lá não há arrastar.
- **Arrastar para um dia (desktop):** soltar abre a escolha de horário já no dia de destino; sem
  horário escolhido, a tarefa continua Sem data.
- **Ordem com o offline-first:** este trabalho vai em cima do `api.ts` atual; o 1kz absorve o modelo
  novo depois (o foco agora é produto/UI).
- **Quota de tarefas Sem data:** conta no mês da âncora (`date` = instante do lembrete, ou da criação
  quando não há dia citado), igual às datadas. *Revisado no plano:* dispensa a coluna `created_at`.

## Fica com quem constrói

Forma do modelo para "sem data" (`date` opcional/nulo vs outro campo), rota de leitura das Sem data,
onde guardar a preferência de semana (tabela de settings no D1 vs metadata do Clerk), mecanismo do
lembrete recorrente, detalhes de animação (seguir `docs/research/2026-10-21-microanimacoes.md`).
