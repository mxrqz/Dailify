# apps/web/src/components/ui — shadcn primitives adapted to the DS

Repo-wide rules: `/RULES.md` (Frontend; Styling and tokens). This file covers only `ui/`.

Radix wrappers from the shadcn CLI (`apps/web/components.json`, style `new-york`). They are owned
code, not vendor files: re-running `bunx shadcn add` on an existing file reverts the edits below, so
diff the output and re-apply them. App widgets live in `components/` or `kit/`, never here.

## Hand-edited files (keep this list complete)

- `button.tsx`: variants `default` (brand), `secondary` (fill), `ghost`, `soft-danger`, `link`,
  plus legacy `outline`. Sizes `sm` 32px, `default` 44px, `lg` 52px, `icon` 44px; the radius grows
  with height (`rounded-sm` up to 44px, `rounded-md` at 52px).
- `dialog.tsx`: `DialogContent` is `glass` over a `scrim` overlay, with fade and zoom on the panel
  itself; `showCloseButton`. Exports `OverlayClose` (44px target, `plain` drops the fill circle),
  reused by sheet, and `DialogOverlay`, reused by `kit/action-sheet.tsx`. The close label is
  `copy.kit.close` from `components/dashboard/copy.ts`.
- `sheet.tsx`: a glass panel on `motion`. `bottom` and `left` close on drag (`canDragSheet` picks
  where a drag may start, `shouldCloseSheet` decides on release) by clicking a hidden
  `SheetPrimitive.Close`, so the caller's `onOpenChange` runs as for Esc. Only those two sides are
  used. Their `transition-none` is load-bearing: `duration-*` also sets `transition-duration` and
  `transition-property` defaults to `all`, so without it the panel trails the finger.
- `tooltip.tsx`: generator defects fixed (listed in its header); `delayDuration` 400 instead of 0;
  one `TooltipProvider` in `App.tsx`, because `skipDelayDuration` only spans one provider; surface
  colors instead of shadcn's inverted `bg-foreground`. App code uses `<Tip>` (`components/tip.tsx`).
- `sonner.tsx`: theme from `@/components/theme-provider`, not next-themes (no provider here, so
  toasts stayed on "system"). Top-center below 768px, bottom-right above. Overrides need `!`
  utilities or the inline `--normal-*` vars, because sonner's CSS is unlayered.
- `progress.tsx`: `value` also goes on Root, which emits `aria-valuenow`.
- `popover.tsx`, `dropdown-menu.tsx`, `command.tsx`: `bg-surface-popover border-surface-line`.

## Local invariants

- shadcn color names (`foreground`, `muted*`, `accent*`, `primary`, `border`, `input`, `ring`,
  `popover*`, `destructive`) are allowed only here. They alias DS tokens in `global.css`: `accent`
  is the hover fill, not the brand; `ring` and `destructive` are `brand-text`.
- A direct child of `DialogPortal` (the overlay) and any `asChild` target need `forwardRef` on
  React 18; without it Radix's Presence gets no ref and the exit animation is cut.
- `DialogContent`/`SheetContent` own background, border and animation. Callers pass layout classes
  only, never `bg-*`, `border-*` or `overflow-hidden` (it clips the glass top edge; scroll a child).
- Keep `data-slot` on every part; tests and selectors use it.
- Enter/exit uses `tailwindcss-animate` (`animate-in`, `fade-in-0`, `slide-in-from-*`), timed with
  the motion tokens (`duration-base|slow`, `ease-out|exit`).
- cva only for exported variant functions (`buttonVariants`, `badgeVariants`). App code renders
  `<Button>`, or calls `buttonVariants()` on a non-button, and never copies its class string.
- Focus: the generator's `focus-visible:ring-[3px] ring-ring/50` is still in most files; edited
  code writes `ring-3`. The `/opacity` focus and `aria-invalid` rings stay until bd `Dailify-k00`.

## Adding a primitive (`bunx shadcn add <name>` in apps/web)

1. Rewrite `import { cn } from "cn"` to `@/lib/utils`; the npm `cn` skips the twMerge extension.
2. Import the single `@radix-ui/react-*` package, not the `radix-ui` meta-package (a second copy).
3. The CLI emits React 19 function components: add `forwardRef` where a ref is needed (above).
4. Convert arbitrary values to tokens or the scale; move any visible string to copy.
5. Add the file to the list above with what diverges.

## Dead files

- Deleted for lack of importers: `accordion`, `card`, `select`, `tabs`, `toggle-group`, `toggle`,
  `badge`, `CommandDialog`. Re-add one with the CLI when a screen needs it.
- `applePayLogo.tsx`, `googlePayLogo.tsx` are not shadcn: brand SVGs for `pages/billing.tsx`.

## Tests

- `sheet.render.test.tsx`: drag rules, Esc, scrim exit with the panel, one visible close button.
- `sonner.render.test.tsx`: the toaster follows `ThemeProvider`.
- Run `bun run test src/components/ui` from `apps/web`.
