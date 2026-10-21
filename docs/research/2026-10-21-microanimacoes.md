# Estudo: microanimações no Dailify

> 2026-10-21 · épico `Dailify-dgb` · fontes: 5 agentes em paralelo (referências de produto, princípios,
> técnica via Context7, código real via grep/GitHub, auditoria do repo). Itens sem fonte primária estão
> marcados **não confirmado**.

## TL;DR

1. **Delight é inversamente proporcional à frequência.** Ação de 100+×/dia ou via teclado: sem animação.
   Ação de dezenas/dia (completar, criar): toque mínimo (≤200ms). Momento raro (dia zerado, primeiro uso):
   aí sim, celebração. (Emil Kowalski, Family/Benji Taylor, Rauno, Sunsama)
2. **Orçamento:** ≤300ms, `ease-out` na entrada, saída mais curta que a entrada, só `transform`/`opacity`,
   nunca `transition-all`, sempre interrompível.
3. **Reduced motion = trocar movimento por fade, não desligar tudo.** `<MotionConfig reducedMotion="user">`
   na raiz + `useReducedMotion` só onde há altura/deslocamento/risco.
4. **Hoje o app não tem sistema de motion:** a curva EXPO está copiada 9×, cada entrada tem duração própria
   (150/200/300/350/450/500ms), `transition-all` em 7 lugares, nenhuma `AnimatePresence`/`layout` no
   dashboard (excluir = vizinhos pulam), e os primitivos shadcn/sonner ignoram reduced motion.
5. **Ordem:** fundação (tokens + `MotionConfig` + migrar pra `motion`) → lista viva (entrar/sair/reordenar)
   → completar → navegar dias → quota → voz.

---

## 1. Princípios (com números)

| # | Regra | Fonte |
| --- | --- | --- |
| 1 | Só anime o que informa: mudança de estado, origem/destino, entrada/saída. Se desligar e o fluxo não parecer quebrado, era supérflua. | [Emil](https://emilkowal.ski/ui/great-animations), Stripe Checkout |
| 2 | Filtro de frequência: 100+×/dia → nada; dezenas → mínimo; ocasional → padrão; raro → delight. | [Emil](https://emilkowal.ski/ui/you-dont-need-animations), [NN/g](https://www.nngroup.com/articles/animation-duration/), [Family](https://benji.org/family-values) |
| 3 | Ação de teclado (atalho, setas, ⌘K) não anima. | Emil, [Rauno](https://rauno.me/craft/interaction-design) |
| 4 | Feedback simples ~100ms; dropdown 150–250ms; modal 200–300ms; 400ms já é lento. | [NN/g](https://www.nngroup.com/articles/animation-duration/) |
| 5 | Saída ≈ 0,75× a entrada. | NN/g |
| 6 | `ease-out` em entrada/saída; `ease-in-out` para movimento na tela; `linear` só em progresso. Nunca `ease-in` em interação. | Emil, [Carbon](https://carbondesignsystem.com/elements/motion/overview/) |
| 7 | App de tarefas é "productive" (Carbon): sutil e eficiente; "expressive" só em momento raro. | Carbon |
| 8 | Press: `scale(0.97)`. Entrada a partir de `scale(0.95)`+fade, nunca `scale(0)`. Popover cresce do trigger. | [Emil](https://emilkowal.ski/ui/7-practical-animation-tips) |
| 9 | Stagger de lista: 30–80ms/item. | Emil |
| 10 | Spring para o que é físico/interrompível (drag, layout); tween para opacidade/cor. Bounce 0–0,15 em UI frequente (o default do motion é 0,25: elástico demais). | [motion](https://motion.dev/docs/react-transitions), [WWDC18](https://developer.apple.com/videos/play/wwdc2018/803/) |
| 11 | Interrompível: CSS transition faz retarget, keyframes reiniciam. Ação destrutiva só dispara ao soltar o dedo. | Emil, Rauno |
| 12 | Só `transform`/`opacity` (`top/left`: 50% de frames perdidos vs 1%). | [web.dev](https://web.dev/articles/animations-guide) |
| 13 | UI otimista; feedback ≤100ms; skeleton só após ~150–300ms de espera e visível no mínimo ~300–500ms (anti-flicker). Sem otimismo em pagamento. | [Vercel guidelines](https://vercel.com/design/guidelines), Doherty |
| 14 | WCAG 2.3.3: motion de interação deve poder ser desligado; cor/opacidade não contam como motion → com reduced motion, troque transform por fade. | [W3C](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html), [web.dev](https://web.dev/articles/prefers-reduced-motion) |
| 15 | Hover animado só com `(hover:hover) and (pointer:fine)`. | Emil |
| 16 | Consistência espacial: sai por onde entrou; "fly instead of teleport". | Rauno, Family |

### Escala de tokens proposta (`global.css` + espelho TS)

| token | valor | uso |
| --- | --- | --- |
| `--duration-instant` | 0ms | teclado, ações 100+×/dia |
| `--duration-fast` | 120ms | press, hover, toggle, check |
| `--duration-base` | 200ms | dropdown, popover, tooltip, saída de toast, colapso de item |
| `--duration-slow` | 300ms | modal, drawer, expandir |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | entrada/feedback (padrão) |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | movimento na tela (M3) |
| `--ease-exit` | `cubic-bezier(0.3, 0, 1, 1)` | sai de vez da tela (M3 accelerate) |
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | já existe; manter para a landing (expressive) |
| `spring.snappy` | `{ type: "spring", visualDuration: 0.2, bounce: 0 }` | layout, reordenar, indicador |
| `spring.soft` | `{ type: "spring", visualDuration: 0.3, bounce: 0.15 }` | drawer, dia zerado |

### Checklist de revisão de uma microanimação

- [ ] Comunica algo (estado, origem, relação)? Se não, sai.
- [ ] Frequência: 100+×/dia ou via teclado → `instant`.
- [ ] Duração e easing são tokens; ≤300ms; saída < entrada; sem `ease-in`.
- [ ] Só `transform`/`opacity`; 60fps com CPU throttled 4×.
- [ ] Interrompível: clique duplo rápido faz retarget sem pulo.
- [ ] Escala parte de ≥0,95, `transform-origin` no trigger.
- [ ] Reduced motion: movimento vira fade, nada quebra.
- [ ] Spring com `bounce` explícito.
- [ ] Na décima repetição ainda agrada?

---

## 2. Referências de produto

| Referência | Momento | O que fazem / por que funciona | Fonte |
| --- | --- | --- | --- |
| Emil Kowalski | Geral | <300ms, ease-out, só transform/opacity, teclado não anima, interrompível. Raycast sem animação de abertura por frequência. | [great-animations](https://emilkowal.ski/ui/great-animations), [animations.dev](https://animations.dev) |
| Sonner | Toast/desfazer | Transitions (não keyframes) para retarget; pilha escala −0,05/índice; swipe por distância ou velocidade >0,11; hover e aba oculta pausam o timer (undo não expira sem ser visto). | [building-a-toast](https://emilkowal.ski/ui/building-a-toast-component) |
| Rauno Freiberg | Gestos | Destrutivo dispara no release; menus frequentes sem motion, só highlight confirmando; "fidgetability". | [interaction-design](https://rauno.me/craft/interaction-design), [devouringdetails.com](https://devouringdetails.com) |
| Family (Benji Taylor) | Fluxos, recompensa | Delight × frequência; confete só no backup (raro); botão faz morph letra a letra "Continue→Confirm"; abas voam na direção tocada; trays de alturas diferentes marcam mudança de passo. | [family-values](https://benji.org/family-values) |
| Apple WWDC18 | Swipe | Springs por damping/response; 100% damping sem momentum, ~80% com; projeção de momentum; rubber band nas bordas; tracking 1:1. | [WWDC18 803](https://developer.apple.com/videos/play/wwdc2018/803/) |
| Vercel/Geist | Otimismo, loading | Otimista + rollback/Undo; destrutivo com Undo em janela segura; skeleton com show-delay e min-time; nunca `transition: all`. | [design/guidelines](https://vercel.com/design/guidelines) |
| Things 3 | Criar | Magic Plus arrastável cria a tarefa exatamente onde é solto. Animação do checkbox **não confirmada**. | [MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/) |
| Todoist | Completar | Som de conclusão configurável + Karma/streaks. Visual **não confirmado**. | [Karma](https://www.todoist.com/it/karma) |
| Sunsama | Dia zerado | Celebra só quando todas as tarefas do dia acabam, não cada uma. | [roadmap](https://roadmap.sunsama.com/improvements/p/completing-a-task-should-feel-more-satisfying) |
| Notion Calendar (Cron) | Navegar dias | `T` hoje, `J/K` ±7 dias, setas andam o nº de dias visíveis. | [Getting around](https://cronhq.notion.site/Getting-around-the-grid-0e2e230ae42d48d2bf43dfe025f3ea55) |
| Duolingo | Recompensa | Marcos de streak como power-up animado; arte estática "not celebratory enough". | [blog](https://blog.duolingo.com/streak-milestone-design-animation) |
| Linear | Velocidade percebida | Local-first: mutação local primeiro, sync em background (fonte secundária). | [performance.dev](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown) |
| cmdk | Lista | Altura via `--cmdk-list-height` com `transition: height 100ms`. | [repo](https://github.com/dip/cmdk) |
| Raycast | Celebração | `raycast://confetti`. | [unsung](https://unsung.aresluna.org/raycasts-confetti-cannon/) |
| Galerias | Inspiração | motion.dev/examples, Mobbin, Godly, Rive showcase. | [motion examples](https://motion.dev/examples), [mobbin](https://mobbin.com) |

Superhuman, Height, Amie, Craft, iOS Reminders, Arc (animações): **não confirmados** (só fontes secundárias).

---

## 3. Técnica (stack: React 18 · framer-motion 12 · Tailwind v4 · sonner 2)

**Decisões:**

1. **Migrar `framer-motion` → `motion`** (`import … from "motion/react"`). Mesmo código, diff mecânico em
   ~22 arquivos + `test/setup.ts`. [guia](https://motion.dev/docs/react-upgrade-guide)
2. **`<MotionConfig reducedMotion="user" transition={spring.snappy}>` na raiz.** Desliga transform/layout e
   mantém opacity/cor. Não cobre `height`, `pathLength` nem deslocamento por variants customizadas: nesses
   pontos continua `useReducedMotion`. [a11y](https://motion.dev/docs/react-accessibility)
3. **CSS primeiro, motion só onde CSS não alcança.** CSS (Tailwind v4): hover/press/focus, `starting:`
   (`@starting-style`, Baseline), `transition-discrete`, popover/dialog, `motion-reduce:`. Motion: saída de
   elemento desmontado, reflow de lista (FLIP), drag, springs com velocidade herdada, número animado,
   sequência.
4. **Lista:** `AnimatePresence mode="popLayout" initial={false}` + `motion.li layout="position"` com key
   `task.id`. Em React 18 o filho direto do popLayout precisa de `forwardRef`. Raio via `style` (motion só
   corrige `borderRadius` vindo de style/animate, não de classe).
5. **Altura auto:** `grid-rows-[0fr→1fr]` (já usado no composer). `interpolate-size` só como progressive
   enhancement (Chromium-only em out/2026).
6. **Rotas:** `viewTransition` do React Router 7 nos `NavLink` (View Transitions same-document é Baseline
   desde out/2025). Dentro da página, motion.
7. **Sem `LazyMotion` por ora:** com drag+layout seria `domMax`, ganho marginal. O ganho de bundle real é
   **`React.lazy` na landing** (hoje o dashboard carrega a landing inteira).
8. **Testes:** `MotionGlobalConfig.skipAnimations = true` no setup se `useAnimate` com `await` atrapalhar.

**Armadilhas:** `layout` mede a cada render (não usar em lista virtualizada nem re-renderizar a lista por
tecla); key duplicada gera fantasma que nunca sai; `custom` tem que ir no `AnimatePresence` **e** no filho
(senão quem sai usa a direção antiga); `motion.create()` sempre no nível do módulo, nunca no render.

---

## 4. Código real de referência

| Padrão | Melhor achado | Por que |
| --- | --- | --- |
| Check desenhado | [animate-ui checkbox](https://github.com/imskyleen/animate-ui/blob/main/apps/v1/apps/www/registry/primitives/radix/checkbox/index.tsx) | `forceMount` mantém o SVG (anima ao desmarcar também); `pathLength` 0→1 em 0,2s após o fill. |
| Risco animado | [AutoGPT TaskRow](https://github.com/Significant-Gravitas/AutoGPT/blob/master/autogpt_platform/frontend/src/app/(platform)/copilot/components/TaskProgressBar/components/TaskRow/TaskRow.tsx) | Linha `aria-hidden` com `scaleX` 0→1 (`origin-left`); reduced motion cai para `line-through` estático. |
| Indicador `layoutId` | [murmur segmented](https://github.com/getumbrel/murmur/blob/main/src/ui/segmented.tsx), [dub toggle-group](https://github.com/dubinc/dub/blob/main/packages/ui/src/toggle-group.tsx) | `layoutId={useId()}` evita colisão entre instâncias; press-scale num span interno. |
| Transição direcional | [murmur new-routine](https://github.com/getumbrel/murmur/blob/main/src/features/routines/new-routine.tsx) | Variants com `custom={dir}`, deslocamento curto (32px), fade puro em reduced motion. |
| Entrar/sair com altura | [murmur routine-item](https://github.com/getumbrel/murmur/blob/main/src/features/routines/routine-item.tsx) | `exit={{opacity:0,height:0}}` + `layout`; só itens recém-criados (`born`) ganham entrada expressiva. |
| Undo no sonner | [NyaNovel store](https://github.com/Nya-Foundation/NyaNovel/blob/main/lib/store.ts) | Delete real em `onAutoClose`/`onDismiss` (sem `setTimeout` paralelo); reinsere no índice original. |
| Número animado | [motion-primitives animated-number](https://github.com/ibelick/motion-primitives/blob/main/components/core/animated-number.tsx) | `useSpring`+`useTransform`+`tabular-nums`, sem dependência nova (não copiar o `motion.create` no render). |
| Barra com spring | [animate-ui progress](https://github.com/imskyleen/animate-ui/blob/main/apps/v1/apps/www/registry/primitives/radix/progress/index.tsx) | Anima `x`/`scale`, não `width`; mantém ARIA do Radix. |
| Swipe | [murmur routine-item](https://github.com/getumbrel/murmur/blob/main/src/features/routines/routine-item.tsx), [Scriberr swipeable-item](https://github.com/rishikanthc/Scriberr/blob/main/web/frontend/src/components/ui/swipeable-item.tsx) | Decide por distância **ou** velocidade, repassa `velocity` à spring, `dragDirectionLock`; bloqueia clique 100ms pós-swipe. |
| Celebração | [mozilla/blurts-server Confetti](https://github.com/mozilla/blurts-server/blob/main/src/app/components/client/Confetti.tsx) | Canvas próprio `aria-hidden`, `disableForReducedMotion: true`, cleanup com `reset()`. |

`getumbrel/murmur` (`src/features/routines/`) é a melhor leitura única: swipe, layout, presença, `layoutId`
e reduced motion em todos os componentes.

---

## 5. Auditoria do Dailify (estado em 2026-10-21)

**Existe:** stagger de entrada na lista (`dashboard/day-section.tsx`, 0,35s EXPO), crossfade
skeleton→card (`task-card.tsx`, 0,45s), swipe com spring (`dashboard/swipe-actions.tsx`, a única spring do
app), expansão do composer via `grid-template-rows`, primitivos shadcn via tailwindcss-animate.

**Problemas:**

- EXPO copiado 9× (7 como `EXPO`, 2 como `EASE`); os tokens `--ease-*` de `global.css` quase não são usados.
- Durações sem sistema: 150 (CSS default), 200 (composer, dialog), 300 (loader), 350 (lista), 450 (card),
  500ms (sheet abre, plan-cards).
- `transition-all` em `ui/button.tsx` (todos os botões), `quota-bar.tsx`, `task-preview.tsx`,
  `ui/input-otp.tsx`, `ui/accordion.tsx`, `ui/progress.tsx`, `mode-toggle.tsx`.
- `quota-bar.tsx` anima `height` (layout) sem reduced motion → trocar por `scaleY` + `origin-bottom`.
- Reduced motion **ignorado** em: swipe-actions (spring e `scale-125`), `scrollIntoView smooth` da
  week-strip, `protected-route.tsx`, quota-bar, todos os primitivos shadcn (dialog/sheet/popover/
  dropdown/tooltip/select), toasts.
- `protected-route.tsx`: `exit` sem `AnimatePresence` (não faz nada).
- `task-card.tsx` mantém o skeleton montado sempre (DOM dobrado por card).
- Sonner usa tema do `next-themes`, mas o app tem provider próprio: o toast provavelmente não acompanha o
  tema.
- Sem `React.lazy`: o dashboard carrega toda a landing (e o framer inteiro).
- `components/CLAUDE.md` cita `day-view.tsx`/`month-view.tsx`, que não existem mais.

**Por momento:**

| Momento | Hoje | Onde entra |
| --- | --- | --- |
| Completar | Otimista com rollback; troca seca (só a cor do título faz fade). Swipe: spring volta e só depois a ação dispara. | `CardBody` em `task-card.tsx` (~440–458); `<li>` em `day-section.tsx:46` |
| Criar | Otimista com id do cliente (sem remount na confirmação). Composer limpa seco; novo item herda o stagger; dia novo faz stagger de tudo. Key `group.time` instável remonta grupos. | `pages/home.tsx` (`handleCompose`), `task-composer.tsx`, `day-section.tsx` |
| Excluir | Item some seco, vizinhos pulam. **Já tem toast com Desfazer (6s) para série**; ocorrência não tem. | `AnimatePresence` em `day-section.tsx:45` e `day-list.tsx:50`; `hooks/useTaskActions.tsx` |
| Navegar dias | WeekStrip só faz scroll suave, sem estado "selecionado". MiniCalendar troca mês seco (`key={index}`); lista cai pro skeleton. | `week-strip.tsx`, `mini-calendar.tsx`, `day-list.tsx` |
| Voz | `wave-form.tsx` órfão (Dailify-2gb); troca seca de ícones, sem tratamento de erro. | `wave-form.tsx` |
| Quota | `transition-all` de `height` em 150ms, sem reduced motion. | `quota-bar.tsx:64,71` |

---

## 6. Plano por momento (→ issues do épico `Dailify-dgb`)

| Issue | O que fazer | Frequência → intensidade |
| --- | --- | --- |
| **dgb.1 Fundação** | Tokens de duração/easing no `global.css` + `consts/motion.ts` (springs); trocar as 9 cópias de EXPO; migrar pra `motion`; `MotionConfig reducedMotion="user"` na raiz; `motion-reduce:` nos primitivos shadcn. | — |
| **dgb.3/dgb.4 Lista viva** | `AnimatePresence popLayout` + `layout="position"` no `day-section`; saída colapsa altura (200ms), vizinhos sobem com `spring.snappy`; entrada expressiva só para o item recém-criado. Undo também na exclusão de ocorrência; delete real em `onAutoClose`. | dezenas/dia → mínimo |
| **dgb.2 Completar** | Check `pathLength` 120ms + risco `scaleX` (fallback `line-through`); sem confete por tarefa. **Dia zerado** = único momento expressivo (`spring.soft`, pulso no header ou confete leve com `disableForReducedMotion`). | dezenas/dia → mínimo; raro → delight |
| **dgb.5 Navegar** | Indicador `layoutId` no dia selecionado; slide direcional de 24–32px por clique/swipe; **sem animação via teclado**; atalhos `T`/`J`/`K` no estilo do Cron (avaliar). | alta → curta |
| **dgb.7 Quota** | `scaleY`/`x` com spring em vez de `height`; número com `useSpring`; ao bater o limite, tray contextual (vaul/sheet) em vez de trocar de página. | rara → padrão |
| **dgb.6 Voz** | Waveform 1:1 com o áudio; botão faz morph entre gravando/processando/pronto; tarefas extraídas entram com stagger de 50ms. | rara → delight |
