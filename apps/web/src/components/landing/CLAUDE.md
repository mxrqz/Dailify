# apps/web/src/components/landing — marketing page sections

The signed-out page at `/` (`pages/landingPage.tsx`, lazy; the Tauri app redirects to
`/dashboard`). Repo-wide rules: [/RULES.md](../../../../../RULES.md). This file holds only what is
local here.

## Layout

- `sections/<name>/`: `index.tsx` exports `<Name>V2` (the header's is `SiteHeaderV2`), `copy.ts`
  holds its pt-BR strings `as const`, and a render test sits beside them (`<name>.render.test.tsx`
  or `index.render.test.tsx`). The CTA has no test file; `footer.render.test.tsx` renders it.
- Private parts sit beside their section: `hero/scene.tsx` and `hero/script.ts`, the
  `features/*-art.tsx` demos with `features/scene.tsx` (`useScene`, `Slot`, `Words`). The world
  section's app logos live in `components/logos/apps.tsx`, shared with `integrations.tsx`.
- The Mew speech kit (`Bubble`, `Ears`, `Tail`, `MessageBox`) lives in `components/mew/`, since
  the app uses it too: add no app -> landing import (RULES "Where code goes").

## Add a section

1. Create `sections/<name>/{index.tsx,copy.ts,<name>.render.test.tsx}`. Wrap the test render in
   `MemoryRouter` when the section renders a `Link`.
2. Mount it in `pages/landingPage.tsx`. Sections use `px-5 py-16 md:py-28` on the `<section>` with
   an inner `mx-auto max-w-6xl` (faq, features).
3. Footer links target ids: `#features` and `#pricing` are wrapper divs in `landingPage.tsx`, and
   `#faq` is on FaqV2's `<section>`. Renaming or moving one silently breaks the footer.

## Invariants

- `BubbleDefs` (the SVG `#bubLine` filter) renders once per page, before any `Bubble`;
  `landingPage.tsx` mounts it. Without it, every Bubble loses its outline and shadow.
- Hero script (`hero/copy.ts`): each `rows[].at` must be a substring of its `say`. `rowsFor` uses
  `indexOf`, so a typo makes the row fire early instead of failing, and `script.test.ts` can't
  catch it. `*…*` in `reply` marks emphasis (`replyWords`). `\n` in `title` is a requested line
  break (the h1 is `whitespace-pre-line`). Timing math stays in `hero/script.ts`, tested by
  `script.test.ts`.
- Demo art is `aria-hidden` (features `Card`, `HeroScene`), so the heading and text beside it must
  carry the whole message.

## Scenes and motion

- A scripted demo is `useScene(ref, async (wait) => …)` from `features/scene.tsx`. It runs only
  while in view. Off-screen it stops, and it restarts from the top, so the script resets its own
  state first (`ok-art.tsx`). It returns `reduce`; when that is true nothing runs and the art
  renders its final frame (`talk-art.tsx` shows `ALL`).
- `HeroScene` (a `setTimeout` set) and `WorldV2` (an `AbortSignal` `wait`) hand-roll their own
  schedulers. They are legacy; don't copy them.
- On top of RULES "Motion": a scale duration equal to a token uses the token (`duration-200` ->
  `duration-base`, `duration-300` -> `duration-slow`). JS curves come from `ease` in
  `@/consts/motion` (WAAPI: `` `cubic-bezier(${ease.outQuint.join()})` ``).
- Need the Mew asleep or alert? Use its `mood` (`remind-art.tsx`: `sleepy`, then `alert`).

## Demos and data

- A demo of a real app surface (`ok-art` = the chat confirm box, `talk-art` = the chat thread)
  should render the chat's presentational parts with fake data. `mew-chat/bubbles.tsx` and
  `confirm-box.tsx` export the parts (`Reply`, `ConfirmBody`); they read `useDailify`, so make them
  props-only before a demo renders them, rather than redraw them. When a demo must
  differ, say why in a comment.
- Pricing numbers come only from `@dailify/shared` (`PLAN_PRICING`, `formatPrice`, `yearlySavings`,
  `QUOTAS`/`limitsFor`), reaching the copy through `{n}`/`{price}` placeholders. `sections/pricing`
  forks `components/pricing/plan-cards.tsx` (used by /premium). That fork is legacy; move to
  PlanCards and its copy when you touch it.
- Hex colors are allowed only for vendor brand colors: `components/logos/` and the `APPS` `color`
  accents in `world/index.tsx`. The `#0000001a` in `BUBBLE_FILTER` is a stray.

## Tests

- `motion` reads prefers-reduced-motion once, on first use. Stub `window.matchMedia` to match
  `reduce` before the first render, restore it afterwards, and assert the final-frame text
  (`features.render.test.tsx`).
- `src/test/setup.ts` stubs IntersectionObserver, ResizeObserver, matchMedia and `Element.animate`.
  The observer stub never fires, so motion's `useInView` stays false: scenes never run in a test, which
  renders either the initial state or (with reduce) the final frame.
