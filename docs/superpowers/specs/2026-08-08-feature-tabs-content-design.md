# FeatureTabs — conteúdo dos painéis (mockups em camadas, estilo mastra)

- **Data:** 2026-08-08
- **Status:** Design aprovado (pré-plano)
- **Área:** `apps/web/src/components/landing/` (landing page, seção FeatureTabs)

## Contexto e problema

O `FeatureTabs` da landing tem 4 abas — **Day / Calendário / Recorrência / Voz** — cuja
área de conteúdo hoje é fraca: mocks simples (`DayMock`, `CalendarMock`, `RecurrenceMock`,
`VoiceMock`, inline em `feature-tabs.tsx`) num painel grande e meio vazio. A **casca** (contorno
SVG que conecta aba↔painel) e o **grão** ambiente (`<Grain>`, Paper Shaders) já estão prontos e
aprovados; falta só o miolo de cada painel.

Referência do usuário: **mastra.ai** — mockups realistas do produto **em camadas, vazando pras
bordas**, com a copy fixada embaixo.

## Objetivo

Preencher cada painel com um mockup rico e convincente do recurso, no padrão mastra, construído
**design-first com componentes reais/reaproveitáveis**: o mockup vira o **norte de design** do app
(não é throwaway) e já é código que o redesign do app reaproveita.

## Não-objetivos (escopo)

- **Redesenhar o app** em si — projeto separado e maior. Este spec cobre só o conteúdo das abas.
  Os componentes criados aqui devem ser adequados a esse redesign futuro, mas o redesign não faz
  parte deste trabalho.
- Novas libs ou animações pesadas.
- Interatividade real: os mockups são **decorativos** (`aria-hidden`), não widgets funcionais.

## Padrão de composição (vale pras 4 abas)

Primitivo de layout novo: **`<TabScene>`**.

- Container relativo que preenche a área de conteúdo do painel.
- **N camadas** de mockup, absolutamente posicionadas, com offsets de "vazamento" (bleed) pras
  bordas. O `overflow-hidden` do painel clipa o excesso → efeito de vazar.
- **Bloco de copy** (`h3` título + `p` blurb) fixado **embaixo-centro**, `z` acima das camadas.
- **Reduced-motion**: camadas estáticas (reusa a convenção `reduce` das `Scene*`).

Gramática fixa de **2 camadas por aba**: `[recurso em ação]` (trás) + `[resultado estruturado]`
(frente, sobrepondo). Cada aba conta uma micro-história e reusa os mesmos componentes.

## Conteúdo por aba

| Aba | Camada de trás (recurso) | Camada da frente (resultado) |
|---|---|---|
| **DAY** — "Seu dia, numa coluna" | Coluna do dia com horários + linha do "agora" (`SceneHorarios`/`NowLine`), vaza topo/esquerda | `TaskCard` expandido (tags, prioridade, duração), sobrepondo, vaza direita |
| **CALENDÁRIO** — "O mês inteiro, num relance" | Grid do mês (dots nos dias cheios, hoje destacado), vaza topo/direita | Card "peek do dia" (lista de tarefas daquele dia), sobrepondo, vaza embaixo/esquerda |
| **RECORRÊNCIA** — "Configura uma vez, roda sozinho" | Painel de config (Repetir ▸ Semanal, chips S T Q Q S), vaza esquerda | Faixa de semanas com a tarefa se repetindo (ocorrências-fantasma) + `Orbit`, vaza direita |
| **VOZ** — "Fala. Virou tarefa." | Captura de voz (waveform + transcrição "amanhã 14h, ligar pro dentista"), vaza esquerda | `TaskCard` que a IA estruturou (14:00, 30min, prioridade, tag) — o "virou tarefa", vaza direita |

## Componentes

- **Reusar**: `TaskCard`, `NowLine`, `Orbit`, `Scene*` (`scenes.tsx`), `wave-form`, o estilo do
  `repeat-picker`, e o grid de calendário existente.
- **Criar onde faltar** — componentes **apresentacionais puros** (props data-in, sem `useDailify`
  nem contexto/rede), pensados pra o app reaproveitar depois. Prováveis: `MonthGrid`,
  `DayPeekCard`, `RecurrenceConfig`, `VoiceCapture`. (`TaskCard` já existe.)
- **`<TabScene>`** (novo): o primitivo de layout acima. O `TabPanel` passa a renderizar
  `<TabScene>` no lugar do atual "copy no topo + `TabMock`". Os `*Mock` inline saem.

## Layout / posicionamento

- **Copy**: `absolute`, embaixo-centro, `max-w`, `z` acima das camadas.
- **Camadas**: `absolute` com translate / inset negativo pra vazar; `z-order` define a sobreposição.
- A content region do painel já é `overflow-hidden` → clipa o bleed. O **grão** fica atrás (`z-0`),
  os mockups na frente.
- Valores de bleed/offset hardcoded como constantes tunáveis (calibração visual por print), sem
  medição runtime salvo se necessário.

## Sequência (de-risk)

1. **Piloto: DAY.** Trava o `<TabScene>`, o bleed nas bordas, a copy embaixo e o padrão de 2
   camadas. Aprovação visual por print.
2. **Replicar** pras outras 3: Calendário, Recorrência, Voz — cada uma reusando o `<TabScene>`.

## Verificação

- `bun run typecheck` + `bun run lint` + `bun run build` verdes a cada passo.
- **a11y**: mockups decorativos `aria-hidden`; a copy real (`h3`/`p`) legível; navegação por teclado
  das tabs (Radix roving tabindex / setas) intacta.
- **Visual**: aprovação por print a cada aba (piloto primeiro).

## Riscos

- **Honestidade**: o mockup mostra UI idealizada até o app alcançar — manter o gap curto e não
  prometer telas que não vão existir em breve.
- **Bleed responsivo**: posicionamento das camadas pode quebrar em larguras diferentes — encapsular
  no `<TabScene>` com valores tunáveis e testar nas breakpoints da landing.
