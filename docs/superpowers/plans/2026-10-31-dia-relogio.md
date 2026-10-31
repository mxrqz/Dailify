# Dia — check-relógio, "A qualquer hora" e metadados coloridos

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps em checkbox.

**Goal:** Trazer pro app três detalhes aprovados no mock `apps/web/public/mocks/ideias.html`: (1) metadados com cor própria (data, horário, recorrência); (2) um check redondo que é um relógio da tarefa; (3) as tarefas sem data viram o bloco tracejado "A qualquer hora" no topo de hoje.

**Base:** `main` depois do merge do plano C (usa `consts/motion.ts` e os tokens de motion).

## Decisões do usuário (2026-10-31)

- **Cores por tipo:** data = azul, horário = âmbar, recorrência = roxo. Cada um com texto colorido + fundo do mesmo tom a ~16%. Ícones lucide como hoje (`CalendarIcon`, `ClockIcon`, `RepeatIcon`).
- **ClockCheck:** círculo com borda (o check do mock). Por dentro, com um recuo da borda, DOIS pontos: o maior na posição da HORA (ponteiro de 12h), o menor na posição do MINUTO. Sem horário = UM ponto só, no centro. Concluída: o círculo enche de `primary`, os pontos somem e o check desenha (como no mock). `role="checkbox"`, `aria-checked`.
- **"A qualquer hora":** substitui a lista Sem data. Fica no topo da seção de HOJE, com borda tracejada, linhas sem fundo próprio. Mantém a semântica atual: recorrentes primeiro (marcadas por período, `CheckHistory`), afazeres depois, lembrete em chip.
- **Coluna lateral do desktop FICA** (casca + puxador), sem conteúdo por enquanto: o usuário pode usar pra outra coisa. Sai o badge de pendentes do puxador.
- **Mobile:** a tela Sem data do pager sai (o bloco já está em hoje). O "+" deixa de ter o modo `undatedOnly` vindo da página.

## Global Constraints

- Tokens only (`global.css` `:root` + `@theme inline`), sem valores arbitrários; sem `as`; strings em `copy.ts`; comentários só no não óbvio, uma linha; Prettier 100.
- Motion: sempre `consts/motion.ts`; só transform/opacity; reduced motion via `MotionConfig` / `motion-reduce:`.
- Commits SEM `Co-Authored-By`. SEM `git push`.
- Gate `bun run check` verde ao fim de cada task.

---

### Task 1: Tokens de metadados + `ClockCheck`

**Files:** `global.css`; Create `components/clock-check.tsx`, `components/clock-check.render.test.tsx`; `components/dashboard/copy.ts` se precisar de label.

- Tokens: `--meta-date`, `--meta-time`, `--meta-repeat` (oklch, `light-dark`, legíveis nos dois temas) e `--meta-*-subtle` via `color-mix(... 16%, transparent)`; mapear como `--color-meta-date` etc.
- `ClockCheck({ checked, onCheckedChange, time?: string /* "HH:MM" */, label })`:
  - SVG `viewBox 0 0 20 20`, círculo r≈9; pontos num raio interno (recuo ~3 da borda). Hora: ângulo `(h % 12 + m/60) * 30°`; minuto: `m * 6°`; 0° = 12h. Ponto da hora maior (r≈1.6), do minuto menor (r≈1.1). Sem `time`: um ponto no centro.
  - Concluída: fundo `primary`, pontos opacity 0, check com `stroke-dashoffset` animado (`duration.base`, `ease.out`). `whileTap`/`active:scale-90`.
  - Função pura `clockAngles("21:00") → { hour: 270, minute: 0 }` exportada e testada (inclui "09:30" → hour 285, minute 180; "12:00" → 0, 0).
- Teste render: `role=checkbox`, `aria-checked` alterna no clique; sem `time` renderiza 1 ponto, com `time` 2.
- Commit `feat(web): check-relógio e tokens de metadados`.

### Task 2: Cartão do dia e composer com o check e as cores

**Files:** `components/task-card.tsx`, `components/dashboard/day-task-row.tsx`, `components/dashboard/task-composer.tsx`, testes existentes desses.

- `TaskCard` ganha slot `check?: JSX.Element` à esquerda do título; some o `Check` verde solto do lado direito (o estado concluído agora é o próprio ClockCheck + título riscado). `DayTaskRow` passa `<ClockCheck time={task time} checked={completed} onCheckedChange={complete/uncomplete}>` usando `useTaskActions`.
- `RepeatChip` → `text-meta-repeat bg-meta-repeat-subtle`, sem borda. `TimeLabel` não-acento → `text-meta-time` (o acento da próxima continua crimson).
- Composer: chip de data/recorrência em `meta-date`/`meta-repeat`, horário em `meta-time`; ghost continua neutro.
- Commit `feat(web): cartão usa check-relógio e metadados coloridos`.

### Task 3: "A qualquer hora" no topo de hoje

**Files:** `components/dashboard/undated-list.tsx` (vira `anytime-block.tsx`), `day-section.tsx`, `day-list.tsx`, `pages/home.tsx`, `undated-column.tsx`, `create-fab.tsx`, `copy.ts`, testes de undated-list/undated-column/mobile-pager/create-fab.

- `AnytimeBlock`: `rounded-field border border-dashed border-surface-line p-1`; cabeçalho "A qualquer hora" + contagem de pendentes; mantém o campo de captura (Enter cria sem data); recorrentes + afazeres como hoje, linhas transparentes com hover `surface-hover`, check = `ClockCheck` sem `time`; recorrência e lembrete com as cores de meta.
- Renderiza no topo da `DaySection` de hoje. Se hoje não tiver tarefa datada, a `DayList` mostra a seção de hoje mesmo assim quando houver tarefa sem data (ou o bloco vazio só com o campo de captura).
- `home.tsx`: mobile sem pager de 2 páginas (só a agenda); `CreateFab` sem `undatedOnly` vindo da página (prop pode sair se ninguém mais usa).
- `UndatedColumn`: mantém casca e puxador, tira `UndatedList` e o badge.
- Commit `feat(web): Sem data vira "A qualquer hora" no topo de hoje`.
