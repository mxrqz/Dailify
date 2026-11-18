# apps/web/src/components/mew-chat — the Mew chat

Repo-wide rules: [/RULES.md](../../../../../RULES.md). This folder is the mobile chat the dock opens
(mounted by `dashboard/create-fab.tsx` when not desktop): one `POST /mew/chat` per turn, confirm boxes
applied to the agenda.

## Layout

- `thread.ts`: pure state machine. `Message`/`Block` types, `chatReducer`, persistence.
- `apply.ts`: pure `writes`/`swap` plus the `useMewApply` hook that runs a box against the agenda.
- `mew-chat.tsx`: container (session, API, quotas, consent, scrim, the dock).
- `chat-drawer.tsx`: `ChatDrawer`, `ChatInput`, `moodOf` and the photo scaling. Its rows read `hour12`
  from `useDailify`, so it is not a provider-free View yet.

## Invariants

- Step lifecycle: `draft -> done -> undone`, or `draft -> cancelled`. `frozen()` (checked rows with a
  title) is exactly what a confirm writes and what undo reverts; don't recompute it elsewhere.
- `act()` in mew-chat.tsx reads the block from the pre-dispatch `messages`, so its step checks see
  the old step. Cancel goes only to the audit row (`setMewAction`); confirm and undo go through
  `apply`, and a `false` dispatches `settle` back to the previous step.
- Persisted per user at localStorage `mewki:mew:<userId>:v1`, last 50 (`KEEP`); a reply still
  typing is dropped on load. mew-chat.tsx saves only when no reply is in flight. `clearLocal`
  (`functions/offline.ts`) does not remove this key yet
  ([Security](../../../../../RULES.md#security-and-privacy)).
- `writes(out, into)` diffs by id (same id = update), `swap()` mirrors it into `tasks` and
  `undatedTasks`. An update sends only `title`, `date`, `alert`: widen that list if a box changes
  more.
- `useMewApply` calls `@/functions/api` itself instead of a `hooks/` writer, because a box applies
  all-or-nothing. It has no offline queue: any refused write, offline included, rolls everything
  back and returns `false` (ponytail: partial failure). `ChatInput` is disabled offline. On success
  it bumps usage, records `setMewAction` and pushes Google Calendar targets. The `latest` ref
  exists only because the context setters are typed value-only
  ([Frontend](../../../../../RULES.md#frontend)).
- mew-chat.tsx matches the server's error texts, shared with it: `MEW_CONSENT_REQUIRED` and
  `QUOTA_ERRORS.ai` from `@dailify/shared` (texts, not codes, so the wire stays as it was).
  A send refused for consent is dropped, kept in `pending` and resent after accept: nothing
  reaches OpenAI before consent (LGPD).
- Caps come from `@dailify/shared` (`MEW_HISTORY_MAX`, `MEW_TEXT_MAX`, `MEW_IMAGE_MAX`). Photos are
  stored as a 320px thumb (localStorage quota) and uploaded at 1024px (`THUMB_PX`/`UPLOAD_PX`).
- The drawer is a non-modal bottom `Sheet` so the dock stays usable; the scrim is rendered by
  mew-chat.tsx. The dock is the input (`CreateDock chat={<ChatInput/>}`, from
  `dashboard/composer-views.tsx`), so `onInteractOutside` ignores `[data-slot="create-dock"]`.
- One `ResizeObserver` is the only writer of `scrollTop` (pinned within 48px of the bottom; a new
  message re-pins). Only messages absent when the drawer opened animate (the `initial` set).
- Enter animations are CSS tokens, not motion: `word-in` + `--i`, `delay-words`/`delay-words-lag` +
  `--words`, `duration-open`, `ease-out-quint`, the grid-rows `Reveal`. The header Mew's mood is
  `moodOf(last, busy)`.

## How to add

- A chat action: a `ChatAction` member and its `chatReducer` case, a `thread.test.ts` case; if it
  writes, wire it in `act()`.
- A server block kind: add it to `MewBlock` (shared `mew.ts`), widen `Block` in thread.ts, render it
  in `Reply`, and update `moodOf` if it should change the mood.

## Known debt

- Copy lives in `dashboard/copy.ts` under `mewChat`; move it to a local `copy.ts` when touching it.
- `MessageBox` comes from `components/landing/kit`, against the dependency direction in
  [Where code goes](../../../../../RULES.md#where-code-goes).
- The credits line uses `.replace` instead of `fill()`.

## Tests

- `thread.test.ts` (jsdom, for localStorage), `apply.test.ts` (node, pure half), `mood.test.ts`
  (node, `moodOf`).
- `mew-chat.render.test.tsx` mocks `@/functions/api`, `dailifyContext` and `@/lib/auth`, and covers
  send, confirm, undo, refused write, consent and out of credits.
