# `src/components/ui/` — shadcn/ui primitives

Generated components (shadcn, config in root `components.json`). Treat as vendored:

- **Don't hand-edit** unless necessary — prefer re-adding/updating via the shadcn CLI so upgrades
  don't clobber your changes. If you must edit, keep it minimal and say why.
- They already use the design tokens (`bg-background`, `border-input`, `ring-ring`, …). Keep it that
  way — no hex, no new one-off colors here.
- Focus rings and `aria-invalid` states use `/opacity` (shadcn defaults); leave them unless the
  solid-color task (`k00`) says otherwise.
- App-specific components belong one level up in `src/components/`, not here.
