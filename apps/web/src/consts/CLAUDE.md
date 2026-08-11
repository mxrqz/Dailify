# `src/consts/` — constants

`conts.ts` (note the spelling) + `conts.test.ts`.

## Endpoints & plans

- **`apiURL`** (`import.meta.env.VITE_API_URL`) = `apps/server` (Hono/Workers, same repo) — every
  read and write goes there via `@/functions/api`. **`dailifyURL`** = prod site.
- **`PLAN_ID`** is the single source for plan ids (`free` / `pro` / `pro+ai`); **`planMap`** maps them
  to labels. Always use `PLAN_ID.*` for checkout ids — a raw string typo silently breaks checkout
  (this bit us before: `"pro-ai"` vs `"pro+ai"`). `conts.test.ts` asserts every `PLAN_ID` is a
  `planMap` key; keep it green. (`@dailify/shared` also exports a `PLAN_ID` with the same values,
  used server-side and for `PLAN_PERMISSIONS` lookups — the two aren't merged, keep them in sync.)

## Colors are token class names, not hex

`tagsBgColors2`, `tagsBorderColors2` are arrays of **Tailwind token classes**
(`"bg-tag-1"`, `"border-tag-1"`, …). The actual colors are tokens in `global.css`.
Don't put hex here — add a token + `@theme inline` mapping instead.

## Priority scale

`priorityTextColor` / `priorityBorderColor` / `priorityBgColor` / `prioritySelectedBgColor` are indexed
by priority level **0–4**. They hold `text-priority-N` / `border-priority-N` / `bg-priority-bg-N`
token classes, defined in `global.css` (bd task `emm`, closed). `prioritySelectedBgColor` marks the
selected level with border+text, not a solid fill — a saturated fill would clash with `text-foreground`
inherited from `ToggleGroupItem` at low contrast; see the comment above it in `conts.ts`.

## Other

- **`weekDays`** — index `0=Sunday … 6=Saturday`, aligned with `Date.getDay()`; recurrence Weekly
  matching depends on this order.
