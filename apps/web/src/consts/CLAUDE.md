# apps/web/src/consts — constants and JS mirrors of CSS tokens

Repo-wide rules: [/RULES.md](../../../../RULES.md). Token and motion policy:
[apps/web/src/CLAUDE.md](../CLAUDE.md). This file holds only what is local to `consts/`.

## Files

- `conts.ts` + `conts.test.ts`: priority class tables, `planMap`, `CALENDAR_VIEW`, `apiURL`.
  `media.ts`: the `useMediaQuery` queries (`DESKTOP`, `MOBILE`, `SHEET_EDITING`, `NO_DRAG`). The filename typo is
  real; import it as `@/consts/conts`.
- `motion.ts` + `motion.test.ts`: `duration`, `ease`, `spring`, `fade` for `motion` and
  WAAPI, and `radius` (px) for surfaces that morph their corners.
- The `PLAN_ID` re-export in `conts.ts` is a shim over `@dailify/shared`; new code imports
  `PLAN_ID`, `PlanRole`, `PLAN_PRICING` and `formatPrice` from shared.

## apiURL

- `VITE_DEV_API` in dev, `VITE_API_URL` in builds. `VITE_DEV_API` is in no `.env`: the
  `vite.config.ts` `define` sets it to `/api` (the dev proxy) or, in mobile dev, to
  `http://127.0.0.1:8787`. Why: [apps/web/CLAUDE.md](../../CLAUDE.md) "Tooling".
- Only `functions/api.ts`, `lib/auth.ts` and `lib/native-auth.ts` read it.

## Priority tables

- Indexed by `Task.priority` 0-4. Each entry is a full literal class (`"text-priority-3"`), never
  `` `text-priority-${n}` ``: Tailwind v4 generates only class names it finds verbatim in source.
- `conts.test.ts` checks every table in its `scales` map: 5 entries, entry `i` names `priority-i`
  (an out-of-order table paints "Urgente" grey and breaks nothing else), no raw palette color, no
  `/opacity`. Add any new table to that map.
- Tables: `priorityText` and `priorityTextColor` (task-card, task-meta-menus, task-form). Weekday
  names and order come from `weekDays`/`dayMap` in `@dailify/shared`.
- `priorityText` is pt-BR copy outside a copy.ts (legacy); new labels go in copy.ts.

## Plans

- `planMap` (id to "Free" | "Pro" | "Max") stays in the web: the server never shows plan names.
- Never type a raw plan id; use `PLAN_ID.*`. A typo fails checkout silently (`"pro-ai"` vs the old
  Max id `"pro+ai"` did). `conts.test.ts` checks every `PLAN_ID` value is a `planMap` key.
- Prices are cents in shared `PLAN_PRICING`, so the server can compare the advertised price with
  what Stripe charges (`apps/server/test/pricing-stripe.test.ts`).

## motion.ts

- `duration` (seconds) mirrors `--motion-duration-*` (ms). `ease` mirrors
  `--motion-ease-out|standard|exit` plus the static `--ease-out-expo|out-quint|out-soft`.
  `motion.test.ts` reads `global.css` and fails on drift: every `duration` key is checked
  automatically, but a new `ease` key needs a row in its `it.each` list.
- `ease.out` is the app's entry curve and also backs Tailwind's `ease-out`. `spring.soft` is the
  approved composer morph, `spring.snappy` the sheet's snap-back; both have `bounce: 0`.
  `--motion-ease-spring` (the `linear()` overshoot) has no JS mirror on purpose: landing only.
- `radius.panel` (22) mirrors `--radius-panel` (1.375rem), checked at 16px per rem.
- The landing takes its curves from here (`ease.outQuint`). The literal copies in
  `landing/sections/` are legacy ([components/landing/CLAUDE.md](../components/landing/CLAUDE.md)).

## Adding a JS mirror of a CSS token

- Any JS value that must equal a CSS token goes here with an assertion that reads `global.css`,
  like `motion.test.ts` does for `radius`.
