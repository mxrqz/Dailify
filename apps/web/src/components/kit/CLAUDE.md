# apps/web/src/components/kit — DS presentational primitives

Repo-wide rules: [/RULES.md](../../../../../RULES.md). This file adds only what is local to `kit/`.

## Contract

- Props in, markup out: no `useDailify`, `useSession`, `@/functions/api` or router hooks. React's
  own hooks for local UI only (`useId` in ListGroup, Refraction's `useEffect`).
- Every visible string is a prop. Defaults come from `copy.kit` (`@/components/dashboard/copy`) and
  stay overridable: Chip `removeLabel`, ActionSheet `cancelLabel`.

## Catalogue

- `ListGroup({ title?, footer?, compact? })` + `ListRow({ icon?, label, sublabel?, value?, trailing?, below?, accessory?: "chevron" | "external", danger?, href?, onClick?, disabled?, asChild? })` (`list.tsx`): the iOS grouped list.
- `SegmentedControl<T extends string>({ value, onValueChange, options, "aria-label" })`: capsule
  radiogroup, selection in `ink`; `className="w-32 flex-none"` for the narrow one beside a label.
- `Switch({ checked, onCheckedChange, ...button })`: `role="switch"` with no visible label, so pass
  the row's text as `aria-label`. A caller `onClick` that calls `preventDefault()` cancels the toggle.
- `Chip({ icon?, variant?: "action" | "select", size?: "default" | "sm" | "square", pressed?, onRemove?, removeLabel? })`:
  `pressed` sets `aria-pressed` and `bg-ink`. With `onRemove` it is a `<span>` of two buttons: ref and
  rest props go to the main one, `className` to the span.
- `PageHeader({ title, subtitle?, bar?, trailing? })`: sticky material bar (`h-bar`) + Large Title.
  It returns a fragment so the bar sticks to the scrolling container; don't wrap it.
- `ProgressRing({ value, max, label })`: 40px ring showing `value/max`; `label` is the full sentence
  for screen readers (the digits are `aria-hidden`).
- `ActionSheet({ open, onOpenChange, title, description?, actions, cancelLabel? })`:
  `role="alertdialog"` over `ui/dialog`'s `DialogOverlay`; every action closes it. Actions are keyed
  by `label`, so labels must be unique. `primary` = bold `brand-text`, `destructive` = `brand-text`.
- `TaskRow({ time, duration?, title, meta?, done?, live?, muted?, onOpen?, trailing? })` +
  `CheckCircle({ checked, onCheckedChange, label? })` (`task-row.tsx`): the agenda row and its
  complete circle, shared by `dashboard/day-task-row` and `mew-chat`.
- `Refraction({ strength = 24, edge = 10 })`: the SVG `<filter id="refract">`, plus
  `<html class="refract">` on Chromium only.

## ListRow and ListGroup

- Tag: `href` gives `<a>`, `onClick` gives `<button type="button">`, neither gives a `<div>` with no
  hover or press styles, and `asChild` uses the child (a router `<Link to=… />`, see
  `IntegrationsSummary` in `../integrations.tsx`). All go through one Radix `Slot`, so a row works
  directly under `XTrigger asChild` (`../delete-account.tsx`, `../time-zone-select.tsx`).
- `trailing` holds narrow controls (Switch, `w-32` SegmentedControl), `below` full-width ones;
  `pages/settings.tsx` shows both. `accessory="external"` adds `target`/`rel` only with an `href`.
- Separators exist only between rows (`group-not-first/row:border-t` on the text column, so the line
  starts after the icon). Never add row borders.
- `compact` (inside sheets: radius 14, 48px rows) reaches rows through `data-compact` + `group/list`.
- Spacing between groups is the caller's: `gap-7` (`accountGroups` in `../settings-list.tsx`).
- The group is already a `card`: never nest another one inside. `IntegrationCard` in
  `../integrations.tsx` is the legacy exception.
- Press and focus tints are `pointer-fine:` only; touch gets no tint.

## Which one

- ActionSheet for a multiple-choice question (`dashboard/recurrence-scope-dialog.tsx`, the
  linked-series delete in `hooks/useTaskActions.tsx`); `ui` Dialog for a confirmation with a body
  (`../delete-account.tsx` typed e-mail, the disconnect in `../integrations.tsx`).
- Chip `action` (radius 10, the default) acts or toggles; `select` (capsule) picks one of many and
  has no caller yet. The `Chip` inside `../task-card.tsx` is a file-local desktop metadata chip, not
  this one.
- SegmentedControl never emits Radix's `""` on re-click and infers `T` from `options`, so
  `onValueChange` needs no cast (`ThemeSelect` in `../theme-select.tsx`).
- Refraction is mounted once, in `App.tsx`: a second copy duplicates the `refract` id. Only the
  `dock-veil` utility reads it (`apps/web/src/CLAUDE.md`). Keep it off `glass`, where re-filtering
  costs too much.

## Don't copy

- `: JSX.Element` return types use the global namespace, `@deprecated` in `@types/react` 18.3;
  omit the return type.

## Adding a primitive

1. A kebab-case file with a named export, built per RULES.md › Frontend (forwardRef + props spread).
2. DS tokens only; strings as props, with any default in `copy.kit`.
3. A case in `kit.render.test.tsx` asserting role and accessible name, with an English `it` sentence
   (the existing ones are legacy pt-BR).
4. A catalogue line here. Verify: `bun run test src/components/kit` from `apps/web`.
