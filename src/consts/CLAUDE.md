# `src/consts/` — constants

`conts.ts` (note the spelling) + `conts.test.ts`.

## Endpoints & plans

- **`serverURL`** = the external Node server (Render) — every write goes here. **`dailifyURL`** = prod site.
- **`PLAN_ID`** is the single source for plan ids (`free` / `pro` / `pro+ai`); **`planMap`** maps them
  to labels. Always use `PLAN_ID.*` for checkout ids — a raw string typo silently breaks checkout
  (this bit us before: `"pro-ai"` vs `"pro+ai"`). `conts.test.ts` asserts every `PLAN_ID` is a
  `planMap` key; keep it green.

## Colors are token class names, not hex

`tagsBgColors2`, `tagsBorderColors2`, `paletteColors` are arrays of **Tailwind token classes**
(`"bg-tag-1"`, `"border-tag-1"`, `"bg-palette-1"`, …). The actual colors are tokens in `global.css`.
Don't put hex here — add a token + `@theme inline` mapping instead.

## Priority scale

`priorityTextColor` / `priorityBorderColor` / `priorityBgColor` / `prioritySelectedBgColor` are indexed
by priority level **0–4**. They still use named Tailwind colors (gray→green→yellow→orange→red);
tokenizing them is bd task `emm`.

## Other

- **`weekDays`** — index `0=Sunday … 6=Saturday`, aligned with `Date.getDay()`; recurrence Weekly
  matching depends on this order.
- `variants` / `childVariants` — framer-motion presets.
