# Motion — fundação do sistema de animação (Dailify-dgb.1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda animação do web app sai de uma fonte única (tokens CSS + `consts/motion.ts`), com reduced motion resolvido na raiz e regras escritas — sem curvas e durações soltas.

**Architecture:** Três camadas: (1) pacote `motion` no lugar de `framer-motion` (mesmo código, import `motion/react`); (2) tokens de duração/easing em `global.css` espelhados em `apps/web/src/consts/motion.ts` com springs e presets, mais `<MotionConfig reducedMotion="user">` na raiz e uma seção "Motion" no `components/CLAUDE.md`; (3) varredura que troca as cópias (`EXPO`/`EASE`, durações soltas, `transition-all`) pelos tokens/presets.

**Tech Stack:** React 18 · `motion` 12 (ex-framer-motion) · Tailwind v4 · vitest.

**Spec:** `docs/research/2026-10-21-microanimacoes.md` (§1 princípios e escala de tokens, §3 técnica, §5 auditoria) + decisões desta sessão (abaixo).

## Global Constraints

- Escala (do estudo): `--duration-instant 0ms`, `--duration-fast 120ms`, `--duration-base 200ms`, `--duration-slow 300ms`; `--ease-out cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-standard cubic-bezier(0.2, 0, 0, 1)`, `--ease-exit cubic-bezier(0.3, 0, 1, 1)`; `--ease-out-expo` continua (landing/expressivo).
- Springs (motion, modelo `visualDuration` + `bounce`): **`soft` = `{ type: "spring", visualDuration: 0.24, bounce: 0 }`** (aprovada pelo usuário no morph do composer — "menos longa, sem rubber band"); **`snappy` = `{ type: "spring", visualDuration: 0.2, bounce: 0 }`**. Sem bounce em UI do app.
- Só `transform`/`opacity` (exceção já registrada: largura da coluna Sem data e `grid-template-rows` do colapso). Nunca `transition-all`.
- Reduced motion: movimento vira fade ou nada; `MotionConfig reducedMotion="user"` na raiz cobre transform/layout; `useReducedMotion` só onde há altura/deslocamento customizado ou `duration` manual.
- Tokens only (root `CLAUDE.md`), sem `as`, comentários só no não óbvio (uma linha pt-BR), Prettier 100.
- **Comportamento visual não muda** além de trocar valores próximos pelos tokens (ex.: 0.35s → `slow` 0.3s, 0.45s → `slow`); a landing pode manter `ease-out-expo` e durações expressivas próprias desde que nomeadas em `consts/motion.ts`.
- Commits sem trailer `Co-Authored-By`. Sem `git push`.
- Gate: `bun run check` verde ao fim de cada task.

## Review Focus

1. Nenhum import de `framer-motion` sobra (inclui `src/test/setup.ts` e mocks em testes). → Task 1.
2. Com `MotionConfig reducedMotion="user"`, componentes que hoje desligam movimento via `useReducedMotion` continuam terminando no estado final (sem ficar invisíveis em opacity 0). → Task 2 teste.
3. Valores de `consts/motion.ts` batem com os tokens CSS (uma fonte só; teste compara). → Task 2.
4. Nenhuma cópia de `EXPO`/`EASE`/`cubic-bezier` numérica fora de `global.css`/`consts/motion.ts`. → Task 3 (grep no step de verificação).

---

### Task 1: `framer-motion` → `motion`

**Files:** `apps/web/package.json`, lockfile (`bun.lock` na raiz), os 24 arquivos de `apps/web/src` que importam `framer-motion` (inclui landing e `src/test/setup.ts`).

- [ ] **Step 1:** `bun --filter @dailify/web remove framer-motion && bun --filter @dailify/web add motion@^12` (mesma major).
- [ ] **Step 2:** trocar `from "framer-motion"` por `from "motion/react"` em todos os arquivos (incluindo `vi.mock("framer-motion", …)` se houver).
- [ ] **Step 3:** `grep -rn "framer-motion" apps/web` → vazio; `bun run check` → verde.
- [ ] **Step 4: Commit** `refactor(web): framer-motion vira o pacote motion`

### Task 2: Tokens, `consts/motion.ts`, `MotionConfig` e regras

**Files:**
- Modify: `apps/web/src/global.css` (tokens `--duration-*`, `--ease-out`, `--ease-standard`, `--ease-exit` em `:root` + `@theme inline` para gerar `duration-*`/`ease-*` do Tailwind; comentário com a origem de cada um)
- Create: `apps/web/src/consts/motion.ts`, `apps/web/src/consts/motion.test.ts`
- Modify: raiz do app (`apps/web/src/App.tsx` ou `main.tsx`) com `<MotionConfig reducedMotion="user">`; `apps/web/src/components/dashboard/create-fab.tsx` usa `spring.soft` e o preset `reveal`; `apps/web/src/components/CLAUDE.md` (seção "Motion")

**Interfaces — Produces (`consts/motion.ts`):**
- `duration: { instant: 0; fast: 0.12; base: 0.2; slow: 0.3 }` (segundos, como o motion usa)
- `ease: { out; standard; exit; outExpo }` — tuplas `[n, n, n, n] as const` iguais às do CSS
- `spring: { soft: Transition; snappy: Transition }` (valores das Global Constraints)
- presets (objetos de props do motion):
  - `fade` — `{ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: duration.base, ease: ease.out } }`
  - `reveal` — conteúdo que aparece depois de um morph: `opacity 0→1`, `duration 0.14`, `delay 0.06` (os valores aprovados no composer)
  - `slideX(dir: 1 | -1, distance = 24)` — variants `enter/center/exit` para `AnimatePresence custom`; com reduced motion o `MotionConfig` já zera o deslocamento
  - `collapse` — saída de item de lista: `exit: { opacity: 0, height: 0 }`, `transition: { duration: duration.base, ease: ease.exit }`

- [ ] **Step 1: Teste que falha** (`motion.test.ts`, ambiente node): lê `src/global.css` como texto e afirma que `--duration-fast: 120ms`, `--duration-base: 200ms`, `--duration-slow: 300ms`, `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` (etc.) batem com `duration.*` (×1000) e `ease.*`; `spring.soft` igual a `{ type: "spring", visualDuration: 0.24, bounce: 0 }`; `slideX(1).enter.x === 24` e `slideX(-1).exit.x === 24`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3: Implementar** tokens, módulo, `MotionConfig` na raiz (envolvendo o router, dentro dos providers existentes), `create-fab.tsx` trocando os números locais por `spring.soft` e `reveal` (e removendo o `useReducedMotion` que só zerava a transição, se o `MotionConfig` cobrir — `reveal` é opacity, que o `reducedMotion="user"` mantém: aceitável, é fade). Seção "Motion" no `components/CLAUDE.md` (≤ 15 linhas): quando animar (frequência, teclado não anima), CSS primeiro / motion para saída-layout-gesto-morph, só transform/opacity, sempre `consts/motion.ts`, reduced motion via `MotionConfig`, link para o estudo.
- [ ] **Step 4:** teste → PASS; um render test existente que use `useReducedMotion` (ex.: `day-section`/`task-card` via suites atuais) continua verde; `bun run check`.
- [ ] **Step 5: Commit** `feat(web): fundação de motion — tokens, presets e reduced motion na raiz`

### Task 3: Varredura — cópias e `transition-all`

**Files (inventário de 2026-10-22):**
- `EXPO`/`EASE` locais: `components/task-card.tsx`, `components/dashboard/day-section.tsx`, `components/landing/{checklist,hero-panel,now-line,task-options}.tsx`, `components/landing/scenes/{scene-horarios,scene-recorrencia,scene-tarefas}.tsx`
- Durações soltas em `transition={{ duration: … }}` no app (`day-section` 0.35, `task-card` 0.45, `protected-route` 0.3, `pricing/plan-cards` 0.5) e na landing (`landing/scenes/timing.ts` já centraliza parte — integrar a ele ou a `consts/motion.ts`)
- `transition-all`: `components/{quota-bar,mode-toggle,task-preview}.tsx`, `components/ui/{button,accordion,input-otp,progress}.tsx`
- `quota-bar.tsx`: anima `height` → `scaleY` + `origin-bottom` (estudo §5)

- [ ] **Step 1:** app (não-landing): trocar por `ease.*`/`duration.*`/`spring.*`; mapear 0.35/0.45 → `duration.slow`, 0.5 → `duration.slow` salvo `plan-cards` (compartilhado com a landing: pode virar `ease.outExpo` + constante nomeada `duration.expressive = 0.5` em `consts/motion.ts` se precisar manter).
- [ ] **Step 2:** landing: importar `ease.outExpo` em vez das cópias; durações expressivas ficam como constantes nomeadas no `timing.ts` existente.
- [ ] **Step 3:** `transition-all` → lista explícita de propriedades (`transition-[color,background-color,border-color,box-shadow]` ou utilitários `transition-colors`/`transition-transform`) com a duração/easing token quando houver; `quota-bar` passa a `scaleY`.
- [ ] **Step 4: Verificar:** `grep -rnE "const (EXPO|EASE) =|cubic-bezier\\(|transition-all" apps/web/src --include=*.ts --include=*.tsx` → vazio (exceto `consts/motion.ts`); `bun run check` → verde; render tests de `quota-bar` continuam verdes.
- [ ] **Step 5: Commit** `refactor(web): animações usam os tokens de motion`; `bd close Dailify-dgb.1`.
