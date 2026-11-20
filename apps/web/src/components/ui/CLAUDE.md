# apps/web/src/components/ui — shadcn primitives adapted to the DS

Repo-wide rules: `/RULES.md` (Frontend; Styling and tokens). This file covers only `ui/`.

Radix wrappers from the shadcn CLI (`apps/web/components.json`, style `new-york`). They are owned
code, not vendor files: re-running `bunx shadcn add` on an existing file reverts the edits below, so
diff the output and re-apply them. App widgets live in `components/` or `kit/`, never here.

## Hand-edited files (keep this list complete)

- `button.tsx`: variants `default` (brand), `secondary` (fill), `ghost`, `soft-danger`, `link`,
  plus legacy `outline`. Sizes `sm` 32px, `default` 44px, `lg` 52px, `icon` 44px, `icon-sm` 32px
  (desktop toolbar and side panel); the radius grows
  with height (`rounded-sm` up to 44px, `rounded-md` at 52px). `bar` is the 44px round icon button
  of a mobile top bar (`variant="ghost"`). `loading` (non-`asChild`) shows a
  spinner, keeps the label as an sr-only name, and sets `disabled` + `aria-busy`; use it instead of
  swapping the label for an icon. Pinned by `button.render.test.tsx`.
- `dialog.tsx`: `DialogContent` is `glass` over a `scrim` overlay, with fade and zoom on the panel
  itself; `showCloseButton`. Exports `OverlayClose` (44px target, `plain` drops the fill circle),
  reused by sheet, and `DialogOverlay`, reused by `kit/action-sheet.tsx`. The close label is
  `close` from `components/kit/copy.ts`.
- `sheet.tsx`: a glass panel on `motion`. `bottom` and `left` close on drag (`canDragSheet` picks
  where a drag may start, `shouldCloseSheet` decides on release) by clicking a hidden
  `SheetPrimitive.Close`, so the caller's `onOpenChange` runs as for Esc. Only those two sides are
  used. Their `transition-none` is load-bearing: `duration-*` also sets `transition-duration` and
  `transition-property` defaults to `all`, so without it the panel trails the finger.
- `tooltip.tsx`: generator defects fixed (listed in its header); `delayDuration` 400 instead of 0;
  one `TooltipProvider` in `App.tsx`, because `skipDelayDuration` only spans one provider; surface
  colors instead of shadcn's inverted page color. App code uses `<Tip>` (`components/tip.tsx`).
- `sonner.tsx`: theme from `@/components/theme-provider`, not next-themes (no provider here, so
  toasts stayed on "system"). Top-center below 768px, bottom-right above. Overrides need `!`
  utilities or the inline `--normal-*` vars, because sonner's CSS is unlayered.
- `progress.tsx`: `value` also goes on Root, which emits `aria-valuenow`.
- `popover.tsx`, `dropdown-menu.tsx`, `command.tsx`: `bg-surface-raised border-separator`.
- Every file: DS color names instead of shadcn's (mapping in `apps/web/src/CLAUDE.md` "Colors");
  shadcn's `accent` hover becomes `fill`, not the brand.

## Local invariants

- A direct child of `DialogPortal` (the overlay) and any `asChild` target need `forwardRef` on
  React 18; without it Radix's Presence gets no ref and the exit animation is cut.
- `DialogContent`/`SheetContent` own background, border and animation. Callers pass layout classes
  only, never `bg-*`, `border-*` or `overflow-hidden` (it clips the glass top edge; scroll a child).
- Keep `data-slot` on every part; tests and selectors use it.
- Enter/exit uses `tailwindcss-animate` (`animate-in`, `fade-in-0`, `slide-in-from-*`), timed with
  the motion tokens (`duration-base|slow`, `ease-out|exit`). Each animated part also carries
  `motion-reduce:animate-none!`: `MotionConfig` doesn't reach CSS keyframes, and the `!` beats the
  `data-[state=*]:` selectors; with no animation Radix's Presence unmounts on close at once.
- cva only for exported variant functions (`buttonVariants`, `badgeVariants`). App code renders
  `<Button>`, or calls `buttonVariants()` on a non-button, and never copies its class string.
- Focus: `focus-ring` (button, dialog close). `input.tsx` keeps the spelled-out
  `focus-visible:ring-3 ring-brand-text/50` because callers cancel it with `focus-visible:ring-0`, which
  twMerge can't match against a custom utility. The `aria-invalid` rings stay until bd
  `Dailify-k00`.

## Adding a primitive (`bunx shadcn add <name>` in apps/web)

1. Rewrite `import { cn } from "cn"` to `@/lib/utils`; the npm `cn` skips the twMerge extension.
2. Import the single `@radix-ui/react-*` package, not the `radix-ui` meta-package (a second copy).
3. The CLI emits React 19 function components: add `forwardRef` where a ref is needed (above).
4. Convert arbitrary values to tokens or the scale and shadcn color names to DS ones; move any
   visible string to copy.
5. Add the file to the list above with what diverges.

## Dead files

- Deleted for lack of importers: `accordion`, `card`, `select`, `tabs`, `toggle-group`, `toggle`,
  `badge`, `CommandDialog`. Re-add one with the CLI when a screen needs it.

## Tests

- `sheet.render.test.tsx`: drag rules, Esc, scrim exit with the panel, one visible close button.
- `sonner.render.test.tsx`: the toaster follows `ThemeProvider`.
- Run `bun run test src/components/ui` from `apps/web`.
