# apps/web/src/components/mew — the Mew mascot

The Mew cat as SVG art, its live controller, and the confirm dialog for external actions.
Repo-wide rules: `/RULES.md` (Frontend and Motion apply most here).

## Layout

- `mew-static.tsx`: data + art. `MOODS` (`satisfies Record<string, Mood>`; `MewMood` derives from
  its keys), `GAZE`, pure `restPose(mood, happy)` and `poseAttrs(pose)`, the `MewArt` SVG with
  parts tagged `data-mew` and the mood decoration groups (`mew-waves`, `mew-think`, `mew-zz`,
  `mew-q`). `MewStatic` = `MewArt` without `pose`.
- `mew.tsx`: `Mew` and its imperative `createMew` controller (rAF half-life springs from
  `spring.ts`, WAAPI for blink, ear flick, hop and the `enter` pop). In-view gating is motion's
  `useInView(ref, { margin: "64px" })`.
- `mew.css`: decorations keyed by `.mew[data-mood=…]`, plus the `prefers-reduced-motion` block.
- `eye-path.ts` morphs the open ellipse into the happy "^"; `head-path.ts` holds `HEAD_D`.
- Speech kit, shared by the landing, the chat and the composer: `bubble.tsx` (`Bubble`,
  `BubbleDefs`, which renders once per page before any Bubble), `ears.tsx`, `tail.tsx`,
  `message-box.tsx`.

## Choosing and using

- `MewStatic` for icons, lists, avatars and anything still: no rAF. `Mew` for a live cat, one or
  two per screen (each frame calls `getBoundingClientRect`). It runs only in view and never under
  reduced motion; while stopped, a prop change settles straight to the final pose.
- Props: `mood`, `happy`, `behaviors` (partial breathe/look/blink/ears/tilt toggles), `lookAt` (a
  ref read every frame: retarget by assigning `.current`), `headFollows={false}` when the parent
  moves the cat (only the pupils follow), `onHeadMove(px)` per frame for a following `Tail`,
  `enter` (hidden before paint, pops in once in view).
- Handle: only `hop()` for one-shot gestures; joy goes through the `happy` prop.
- `Mew` is always decorative (`aria-hidden`). On `MewArt`/`MewStatic`, `title` makes it
  `role="img"`, so pass it only when the cat is the only content there. `tone="onBrand"`
  (brand-red backgrounds) exists on `MewArt`/`MewStatic` only.

## Invariants

- After the first render React never touches the animated attributes: `pose` is frozen in
  `useState` and the controller writes `transform`/`opacity`/`d` directly. Never pass changing
  pose-derived props from `Mew` to `MewArt`.
- `poseAttrs` is the one source of part geometry for the static art and every frame: change how a
  part looks there, not in `draw()`.
- WAAPI animates its own wrapper groups (`hop`, `flick`, `blink`), never one whose `transform`
  attribute the springs write (`body`, `head`, `ear`, `lid`, `pupil`): CSS transform replaces it.
- A new `Pose` field goes in `Pose`, `restPose`, `createMew` (`pose` record, `draw()`, a
  `springStep`) and the `POSE` list, which isn't exhaustive-checked (`settle()` would skip it).
- viewBox `-160 -160 1600 1500`; the head path is in potrace units under `HEAD_T`
  (`translate(0 1280) scale(.1 -.1)`); `transformOrigin` styles are viewBox px. clipPath ids come
  from `useId`, unique per instance (pinned by mew.render.test.tsx).

## How to add a mood

1. A `MOODS` entry: `blink` range in ms or `null`, `look` (a `GAZE` key), `dil`, `lid`, `joy`,
   `tilt`, `ears` [left, right] in degrees, `breath` [period s, amplitude], `flick`.
2. Its decoration as `<g className="mew-x mew-<name>">` inside `MewArt`'s head group (`mew-x` is
   the opacity fade), styled in mew.css under `.mew[data-mood="<name>"]`. If its keyframes start at
   opacity 0, add it to the reduced-motion override so it shows statically.
3. Optionally a one-shot on entering it, in `onMood` (mew.tsx), as `alert` hops.

Never draw zzz, dots or fake eyes around a Mew from outside: `sleepy` already shuts the lids and
shows the zzz (`features/remind-art.tsx`). The literal
curves and durations in mew.css and mew.tsx keyframes are legacy; new ones use motion tokens.

## confirm-action.tsx

- `ConfirmAction` is the confirm dialog for every external action (epic zpq; today
  `add-to-calendar.tsx`). A new provider reuses it with its own `preview` and optional `option`;
  `pending` blocks closing.
- Its strings sit in `dashboard/copy.ts`; move them to a local `copy.ts` when
  touching them.

## Tests

- `mew.render.test.tsx` (jsdom): static poses via the `opacity` of `data-mew` parts, unique clipPath
  ids, and the live cat staying decorative. The IntersectionObserver stub never fires, so the controller never
  starts: assert on the first-render pose.
- `spring.test.ts` (same result at 60 and 120 Hz), `eye-path.test.ts`.
- Screen tests that ignore the cat mock it to `() => null` (`dashboard/day-list.render.test.tsx`).
