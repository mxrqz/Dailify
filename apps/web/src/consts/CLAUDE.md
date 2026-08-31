# `src/consts/` — constants

`conts.ts` (note the spelling) + `conts.test.ts`.

## Endpoints & plans

- **`apiURL`** (`import.meta.env.VITE_API_URL`) = `apps/server` (Hono/Workers, same repo) — every
  read and write goes there via `@/functions/api`. **`dailifyURL`** = prod site.
- **`PLAN_ID`** vem de `@dailify/shared` e é só **reexportado** aqui (havia duas declarações com os
  mesmos ids; duas listas iguais só ficam iguais até alguém mexer numa). **`planMap`** mapeia id →
  rótulo e fica no web, porque o servidor nunca mostra plano pra ninguém. Sempre use `PLAN_ID.*` nos
  ids de checkout — string crua com typo quebra o checkout em silêncio (já aconteceu: `"pro-ai"` vs
  `"pro+ai"`). `conts.test.ts` garante que todo `PLAN_ID` é chave de `planMap`; mantenha verde.
- **`pricing.ts`** é reexport de `@dailify/shared`: o preço vive lá, em **centavos** (`PLAN_PRICING`),
  com `formatPrice`/`yearlySavings`. Ficar no shared é o que permite ao servidor comparar o
  anunciado com o cobrado (`apps/server/test/pricing-stripe.test.ts`).

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
