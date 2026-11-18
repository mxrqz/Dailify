# apps/web/src/components/dashboard — Today agenda, composer, task editing, app nav

Repo-wide rules: [/RULES.md](../../../../../RULES.md) (Frontend; Styling and tokens; Copy and i18n).
Task writes and their hooks: `hooks/CLAUDE.md`. This file also covers `sidebar/`.

## File map

- Agenda: `day-list.tsx` → `day-section.tsx` (`dayAnchorId`, `weekdayDate`) → `day-task-row.tsx`
  (`DayTaskRow` container; `TaskRow`, `CheckCircle`, `NowLine` views; `SHEET_EDITING`).
- Undated: `anytime-block.tsx` (today's card, `ScheduleDrop`), `check-history.tsx`;
  `undated-column.tsx` is a reserved, empty desktop column (bd `Dailify-1td`).
- Navigation: `week-strip.tsx` (`WeekDays`/`WeekStrip`), `month-calendar.tsx` (`MonthGrid`/
  `MonthCalendar`, the `?view=calendar` overlay of `pages/home.tsx`). Gesture: `swipe-actions.tsx`.
- Creation: `create-fab.tsx`, `task-composer.tsx` (container), `composer-views.tsx` (views, plus the
  `CreateDock`/`DockButton` that `mew-chat/` imports), `calendar-chip.tsx` (`useCalendarChip`).
- Editing: `task-form.tsx` (sheet: `components/edit-task.tsx`), `task-meta-menus.tsx`, pickers
  (`day-picker`, `date-time-picker`, `links-field`), `recurrence-scope-dialog.tsx` (copy over kit
  `ActionSheet`). `push-toggle.tsx` is a settings row (`pages/settings.tsx`).
- `copy.ts` is the dictionary of the whole authenticated app (see `components/CLAUDE.md`).
- `styles.ts`: only `calendarPanel` is shared; `fieldClass`/`bareFieldClass` have one user each, and
  the `chip*` exports are dead.
- Legacy-alias holdouts, don't copy: `undated-column.tsx`, `SchedulePicker` in `anytime-block.tsx`,
  `styles.ts` `fieldClass`, `day-picker.tsx`, `create-fab.tsx`.

## Two editing modes, never both

- `SHEET_EDITING = "(hover: none), (max-width: 639px)"`. Matched: rows are the read-only `TaskRow` +
  `CheckCircle` inside `SwipeActions`, and all editing happens in the `EditTask` sheet. Otherwise:
  the legacy `TaskCard` with chip popovers (its `edit` prop).
- Read once per list and passed down (`DaySection` → `DayTaskRow sheetEditing`; `AnytimeBlock`).
  `mew-chat/chat-drawer.tsx` also renders `TaskRow`/`CheckCircle`: keep them props-only.
- A recurring reschedule from the desktop time chip asks the scope (`RecurrenceScopeDialog`); the
  alert shifts by the same delta. Delete scope and Calendar-linked confirm are
  `useTaskActions().deleteDialog`, rendered by the caller. Per-row dialogs mount on first use.

## Composer

- `TaskComposer` mounts only inside `CreateFab` (`pages/home.tsx`). Mobile: `MewChat` owns the dock;
  the mic opens the bottom `Sheet` already recording (`listen`). Desktop: the "+" morphs into a
  Radix Dialog, or a docked panel (`useStoredFlag("dailify:composer-docked")`).
- The desktop modes share `layoutId="composer-surface"`; its radii follow the morph rule in
  `apps/web/src/CLAUDE.md` › Motion, and today's `RADIUS_*` (12) have drifted from it.
- Submit contract: the composer never writes a single task. `onSubmit(values, again)` returns
  `Promise<boolean>`; the sheet closes at once (optimistic) and reopens with the `retry` text on
  `false`; Shift+Enter (`again`) keeps it open. Multi-draft Mew creates go through `createMany`
  (`useCreateTask`).
- Parse model: the local parser runs per keystroke. `ignore` spans (removed chips, kept valid by
  `remapSpans`) put words back into the title. `edits` (`withEdits` in `functions/compose-input.ts`)
  override what was read and survive typing. Editing the text resets the Mew result and its
  calendar tags. Mew drafts have no spans, so no underline marks.
- `ComposerField`: a mirror div (height, `UNDERLINE` marks) under a transparent textarea, sharing
  font and padding exactly. `text-base` is the minimum, or iOS zooms on focus.
- Chip slots stay mounted in a fixed order (repeat or day, time, duration, reminder, first link), so
  the strip doesn't reflow per keystroke. `MetaChip` without `onRemove` only edits (`ghost` = the
  empty "+ x" look); without `editor` it only displays (the reminder).
- The textarea id `composer-text` is also read by `create-fab.tsx` (`n` and `/` focus, focus after a
  calendar day pick, the pointer-leave "has text" guard). Rename it in both files.

## Chip editors (`task-meta-menus.tsx`)

- Shared by both composers and the desktop `DayTaskRow`, so `DayPicker` and `TimeWheel` also run on
  touch (the wheel scrolls natively there and drags by hand only for the mouse).
- Each takes its trigger as `children` under `*Trigger asChild`. Single choice is a
  `DropdownMenuRadioGroup`, never a nested Select; a Popover only when the panel holds an editor
  (text field, calendar, wheel), because a menu item closes on the first click.
- Popover editors buffer and call `onChange` once on close, only if changed: callers PATCH in
  `onChange` (`DayPopover` is pick-and-close). Option lists keep an off-grid current value
  (`DURATIONS`, `minuteOptions`, `everyOptions`) so it never snaps.

## TaskForm (`task-form.tsx`)

- A stack of pages (`FormView`: root/title/tags/links/meet); `edit-task.tsx` draws the header from
  `FORM_VIEWS[view].title`. Date, time and single-choice fields are native controls laid over a
  `ListRow` on the root (`NativeRow`), not pages.
- Dirty tracking compares JSON snapshots; links compare to `savedLinks`, so a server-saved Meet
  doesn't light "Salvar".
- `links` also carries the Google Calendar event URL (`isCalendarEventLink`). Editors touch only the
  task's own links and must re-append `calendarLinks`, or the task is unlinked from the calendar.
- Undated: `date` only orders the list; the reminder is a day fired at `DEFAULT_HOUR` (09:00), shown
  through `undatedReminder`. Toggling undated carries the chosen day across.
- `locked` (a Calendar invite you don't organize) disables title, date, time, duration, the undated
  switch, repeat, interval and weekdays. Priority, tags and links stay editable.
- Weekly starts with the task's own weekday: an empty `Weekly` never fires (shared `normalizeRepeat`
  turns it into "Off"). `copy.form.repeatDays` and `copy.aside.weekDayInitials` are Sunday-first,
  aligned with shared `weekDays`/`dayMap`.

## How to add a chip field

1. Add the `Field` to `packages/shared/src/parse-task/index.ts` and fill `fields` in the parser.
2. Add its `UNDERLINE` color in `composer-views.tsx` (a compile error until you do).
3. Add an `Edits` key and a `withEdits` branch in `functions/compose-input.ts`, with a test.
4. Add the editor to `task-meta-menus.tsx` and a fixed `MetaChip` slot in `task-composer.tsx`.
5. Add `add*`/`edit*`/`remove*` strings to `copy.composer`.

## Agenda

- `DayList` spans today (or an earlier `selectedDay`) to the end of the contiguous `loadedMonths`
  (`nextMonthToLoad`): one `DaySection` per day with tasks, plus `targetDay`. Today stays when
  undated tasks exist, because `AnytimeBlock` lives in today's section.
- The sentinel uses `rootMargin: "0px 0px 200% 0px"` and gives up after `MAX_EMPTY_MONTHS` (12)
  months without a task. The skeleton shows only at boot (`isLoading && !tasks`).
- `dayAnchorId(day)` = `day-yyyy-MM-dd`, absent in calendar mode. `DayList` scrolls to it when
  `targetDay` changes; a remount with the same target keeps the restored scroll.
- `useVisibleDay` picks the last section whose top crossed 64px, if it is in this week; a
  `targetDay` pins the pill until `touchstart`/`wheel`/`keydown`. Its `section[id^='day-']`
  selector re-types the anchor prefix, so change both together.
- `NowLine` sorts at `nowAt - 0.5`, so a task starting this minute sits below it. Only today uses
  `useNow(60_000)`. The row stagger runs only for today and the calendar day, so months loaded
  mid-scroll don't animate.
- New widget: a props-only View plus a container in the same file that reads `useDailify`, per-day
  tasks via `getTasksForDay` (never a hand filter), time via `useNow`, and writes through a `hooks/`
  action; a co-located render test.

## Drag to schedule (desktop)

- Undated rows drag with `DRAG_TYPE = "application/x-mewki-task"`; other drags are ignored. Mouse
  only: `NO_DRAG = "(max-width: 767px), (pointer: coarse)"`.
- `ScheduleDrop` wraps each `DaySection` and week pill; the child paints `data-drop-over:`. A drop
  opens a `TimeWheel` popover and only "Agendar" writes (`useUndatedActions().schedule`). The drop
  time is 09:00, or the next full hour (capped at 23) when today is past 09:00.
- `content-visibility` on sections is mobile-only: on desktop it clips the drop outline.

## SwipeActions (touch rows)

- Right completes, left deletes. The return is a hand-run spring and the action fires after it,
  because `dragSnapToOrigin` dies when `setTasks` re-renders the row (motion#636).
- `dragListener={false}`; the drag starts only outside 24px screen edges (`startsSwipe`, the system
  back gesture). `onClickCapture` swallows the click that ends a drag. `dragElastic={1}`.
- Fires past `min(25% of width, 96px)` or on a flick ≥400px/s that moved ≥24px. The translucent
  success/destructive panels are deliberate: they read as behind the row.

## sidebar/

- App-shell nav: `Sidebar` is mounted by `components/app-layout.tsx` (md+), `MobileNav` by
  `components/app-header.tsx` (below md, the glass drawer `Sheet side="left"`).
- `NavMenu` is props-only and shared by both (items are the `NAV_ITEMS` list); `NavItems` wires
  session and quotas, and the meter draws `QuotaState.ratio`. `/premium` shares
  the layout without `ProtectedRoute`, so account, credits and sign-out appear only when logged in.
- The active item is neutral on purpose (brand would compete with the primary action), and nothing
  stays lit on mobile. `alsoActive="/premium"` lights "Planos" though it links to `/billing`.
- `MobileNav` closes only on a location change, adjusted during render (a link, even to the current
  route, and the device back); tapping the account or the meter leaves it open.
  The credits meter hides while quotas load or when AI is unlimited. Tests assert
  `aria-current="page"`.

## Tests

- `task-composer.*.render` (chips, Mew, calendar tag, voice) run the real hooks, mock
  `@/functions/api`, `@/lib/auth`, `dailifyContext` and `sonner`, and need a `MemoryRouter`
  (`MewCard` links to `/premium`). `create-fab.render` mocks the hooks instead.
- `anytime-block.render` also covers today's undated `DayList`, `CheckHistory`, `useUndatedActions`
  and drag-drop; `DaySection` has no test of its own. New cases go in the component's own file.
