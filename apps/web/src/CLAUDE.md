# apps/web/src — design system (global.css) and motion

Repo-wide rules: [`/RULES.md`](../../../RULES.md) ("Styling and tokens", "Motion"). This file maps
where every token lives and how to add one. Tailwind 4, CSS-first: there is no `tailwind.config`.

## global.css, top to bottom

- Header: `@import "tailwindcss"`, `@plugin "tailwindcss-animate"` (the v3 plugin behind the
  `data-[state]:animate-in/fade-in-0/zoom-in-95` classes in `ui/`), `@custom-variant dark`.
- `:root`: every raw value (`--motion-*`, DS palette, shadows, widths, `--layer-*`).
  `.dark`/`.light` only set `color-scheme`; `components/theme-provider.tsx` puts one on `<html>`.
- `@theme inline`: var mappings that generate utilities (`--color-*`, `--radius-*`, `--shadow-*`,
  `--width-*`, `--max-width-*`, `--z-index-*`, `--transition-duration-*`, `--ease-*`) and the
  `--default-transition-*` pair, so a bare `transition-*` runs at `fast` on `ease-out`.
- `@theme`: fonts, `ease-out-expo|out-quint|out-soft`, the type scale (`text-2xs`,
  `text-title-1|title-3|body|subhead|footnote`), `animate-dot|caret-blink` and keyframes.
- `@utility` blocks, `@layer base`, then `#root` and the `scrollbar-floating`/`skeleton` utilities.

## How to add a token (its WHY goes in a one-line comment on it, like `--radius-field`)

- Color: `--x: light-dark(oklch(…), oklch(…))` in `:root` (a derived shade is a
  `color-mix(in oklch, …)` of tokens), then `--color-x: var(--x);` in `@theme inline`. Never the
  value itself in `@theme`: only the inline mapping puts `var(--x)` in the utility, which is what
  lets `glass` re-point it for a subtree.
- Radius, width, shadow or z layer: a `:root` value plus its `@theme inline` mapping, then the
  utility name in `lib/utils.ts` `extendTailwindMerge` (theme keys `text`, `radius`, `shadow`,
  `ease`; others via `classGroups`, e.g. `w: [{ w: ["sheet"] }]`) and a pair in `utils.test.ts`.
- Duration or easing: `--motion-*` in `:root`, `--transition-duration-*` / `--ease-*` in
  `@theme inline`, and the same value in `consts/motion.ts` (seconds there, ms in CSS).
- Geometry off the spacing scale (safe areas, hit areas, dock clearance): an `@utility` built on
  `--spacing()` and `env()`, never a `calc` in JSX; register it in twMerge too.
- Tests: `consts/motion.test.ts` parses global.css and fails on drift; `lib/utils.test.ts` pins
  twMerge. Run both from `apps/web` with `bun run test src/consts src/lib`.

## Colors

- DS names: `canvas`, `surface(-raised)`, `fill(-pressed)`, `separator`, `card-edge`, `ink`,
  `ink-secondary`, `ink-tertiary` (placeholder and disabled only: under 4.5:1), `brand(-pressed)`,
  `brand-text` (red text, errors, focus), `brand-soft(-pressed)`, `on-brand`,
  `material-bar(-solid)`, `scrim`, `meta-*(-subtle)`, `priority-0..4`, `success(-soft|-soft-strong)`,
  `control-mark`.
- There is no shadcn color bridge: a primitive from the CLI gets DS names (`foreground` → `ink`,
  `muted-foreground` → `ink-secondary`, `border`/`input` → `separator`, `accent`/`muted` → `fill`,
  `popover`/`card` → `surface-raised`, `primary` → `brand`, `destructive`/`ring` → `brand-text`).
- An alias like `--x: var(--fill)` is computed on `:root` and inherited as a value, so `glass`'s
  override reaches only `bg-surface`, `bg-fill`, `bg-fill-pressed` and `card`.
- `light-dark()` in a custom property resolves where a real property uses it, so `.light`/`.dark`
  on any element flips its subtree; `.light` re-sets `color`, which arrives already resolved. No
  subtree uses it today. Radix portals mount in `body` and take the `<html>` theme.
- Hex that changes with `--canvas`/`--brand`/`--ink`: PWA manifest (`vite.config.ts`), Android
  `res/values{,-night}/themes.xml` (`src-tauri/gen/android`), `tauri.conf.json` `backgroundColor`,
  `scripts/icons.ts`. Vendor hex: `components/logos/`.

## Materials and utilities

- `card`: `surface` plus a 1px inset `outline` (`card-edge`), drawn above row fills that
  `overflow-hidden` clips. `scrim` is color only: a blur would refilter the screen every frame.
- `glass`: overlay panel (Sheet, DialogContent, ActionSheet, drawer; not popovers). No ancestor
  with opacity < 1, filter, mask or mix-blend-mode (a fading AnimatePresence wrapper kills the
  blur); animate only the panel's transform/opacity; no `overflow-hidden` on it (clips the top
  spec line); at most two layers. Caller rules for `SheetContent`/`DialogContent`: `ui/CLAUDE.md`.
- `dock-veil` is the only consumer of `var(--refract,)` (`:root.refract`, set by
  `kit/refraction.tsx`): Chromium-only, empty under reduced motion or transparency.
- `hit-target`: a 44px `::after`, so the element must be positioned. Safe-area math: `pb-safe`,
  `pb-dock`, `pb-dock-clear`, `h-bar` (height and padding-top), `pt-safe`, `top-safe`,
  `scroll-mt-bar`. `px-gutter`/`pr-gutter` pad in percent of the containing block, so `pr-gutter`
  doesn't subtract the sidebar. Also `min-w-duration` (6ch), `min-h-2lh`, `fade-top`,
  `max-h-sheet` (bottom sheets), `h-below-bar` with `top-(--bar-desktop)` (desktop sticky columns).
- `focus-ring` is the only focus style (`ring-3 ring-brand-text/50` on `focus-visible`); group-driven
  focus spells out the same values. `caps` is the mono uppercase label.
- `word-in` reads `--i`, `delay-words(-lag)` reads `--words`, set through the typed `cssVar()` in
  `components/mew-chat/bubbles.tsx`.

## cn(), offenders, z layers

- twMerge knows the custom `text-*`, `rounded-*`, `shadow-*`, `ease-*`, `duration-*`, `z-*`,
  `w-sheet|side`, `max-w-bubble`, `max-h-sheet`, `h-bar|below-bar`, `pb-*`, `pt-safe`,
  `top-safe`, `px-gutter`, `pr-gutter`, `scroll-mt-bar`, `min-w-duration`, and `caps` as a font
  size (so it replaces a Button's `text-subhead`).
- Don't use: `ring-[3px]` focus recipes (use `focus-ring`), `tracking-[0.04em]` caps labels (use
  `caps`), `max-h-[94svh]` (use `max-h-sheet`), `h-[calc(100dvh-…)]` (use `h-below-bar`),
  `rounded-xl` (Tailwind's 12px, off the DS scale; panels are `rounded-lg`). Scale forms:
  `ring-3`, `min-w-32`, `max-h-75`, `top-1/2`, `-translate-1/2`.
- Page layers: `z-bar` (20) < `z-float` (30) < `z-chat` (35) < `z-dock` (40) < `z-overlay` (50).
  Numeric z only for stacking inside one component.

## Motion

- JS mirrors (`duration`, `ease`, `spring`): `consts/CLAUDE.md`. WAAPI takes
  `` `cubic-bezier(${ease.outQuint.join()})` ``, or reads the landing-only `--motion-ease-spring`
  via `getComputedStyle`. `ease-out` overrides Tailwind's default curve; a `transition-*` with no
  duration gets `duration-fast` and `ease-out`.
- Exceptions to transform/opacity: the `grid-template-rows` reveal (`starting:grid-rows-[0fr]`, the
  Reveal in `mew-chat/bubbles.tsx`), the side column's width and margin (`dashboard/side-column.tsx`),
  the check's `stroke-dashoffset` (a 14px path, `kit/task-row.tsx`) and an exiting agenda row's
  `height`/`margin` collapse after it has faded (motion `exit`, `dashboard/day-section.tsx`).
- Motion corrects a radius during a layout morph only when it comes through `style`, so a morphing
  surface takes a px number equal to its token: `radius.panel` from `@/consts/motion` (tested).
  `create-fab.tsx`: `RADIUS_PANEL` = 22 (`--radius-panel`), `RADIUS_FAB` = 14 (`--radius-md`).
- `<MotionConfig reducedMotion="user">` (`App.tsx`) covers only the motion library; CSS utilities
  carry their own `@media` (`word-in`, `skeleton`). Research: `docs/research/2026-10-21-*.md`.
