# apps/web/src/components/dashboard — Today agenda, composer, task editing

Repo-wide rules: [/RULES.md](../../../../../RULES.md) (Frontend; Styling and tokens; Copy and i18n).
Task writes and their hooks: `hooks/CLAUDE.md`.

## File map

- Agenda: `day-list.tsx` → `day-section.tsx` (`dayAnchorId`) → `day-task-row.tsx`
  (`DayTaskRow` container, `NowLine`), over kit `TaskRow`/`CheckCircle`.
- Undated: `anytime-block.tsx` (today's card, `ScheduleDrop`), `check-history.tsx`;
- Layout: `side-panel.tsx` is the desktop side panel (below, "Side panel").
- Navigation: `week-strip.tsx` (`WeekDays`/`WeekStrip`), `month-calendar.tsx` (`MonthGrid`/
  `MonthCalendar`, the `?view=calendar` overlay of `pages/home.tsx`; on `DESKTOP` it renders the
  full-height `MonthBoard`, whose cells open `{ kind: "day" }` in the side panel and light while
  it is open). Gesture: `swipe-actions.tsx`.
- Creation: `create-fab.tsx`, `task-composer.tsx` (container), `composer-views.tsx` (views),
  `calendar-chip.tsx` (`useCalendarChip`). The mobile dock is `mew-chat/dock.tsx`.
- Editing: `task-form.tsx` (sheet: `components/edit-task.tsx`), `task-meta-menus.tsx`, pickers
  (`day-picker`, `date-time-picker`, `links-field`), `recurrence-scope-dialog.tsx` (copy over kit
  `ActionSheet`).
- `copy.ts` is the dictionary of the whole authenticated app (see `components/CLAUDE.md`).
- `styles.ts` holds only `calendarPanel`, shared by `task-meta-menus` and `anytime-block`.

## Side panel (desktop, `side-panel.tsx` + `hooks/usePanel.ts`)

- State is a module store: `usePanel(): PanelState | null`, where `PanelState` is
  `{ kind: "task"; id; day? } | { kind: "mew" } | { kind: "day"; day }` (`day` = epoch-ms). Write
  it from anywhere with `openPanel(state)`, `closePanel()`, `togglePanel()` (opens `mew`). It is
  not in the URL and survives route changes: the sidebar's "Conversar com a Mew" opens it, then
  links to `/dashboard`.
- `PanelHost` (mounted by `pages/home.tsx` only when `DESKTOP` matches) closes on Esc unless a
  dialog or menu is open, and maps each `kind` to a `SidePanel`. Fill a kind there: pass `title`,
  `actions` (`Button size="icon-sm"`), `children` (the scrolling body, `gap-5`) and `footer`. The
  `mew` kind renders only the `MEW_PANEL_SLOT` div: `MewChat` portals its `SidePanel` into it,
  because the thread state lives in the always-mounted chat, not in the panel.
  `day`: kit `TaskRow` + `CheckCircle` rows (`useTaskActions`), a row opens `{ kind: "task" }`; home
  passes `onCreateOn` (`setCreateOn`) and `onOpenDay` (goToDay, leave the calendar, close).
- `SidePanel` is the props-only glass View, `w-side` (400px), id `SIDE_PANEL_ID` (the toolbar
  toggle's `aria-controls`). From `xl` it is a sticky column that pushes the agenda; below it is
  `fixed` over the right edge with `shadow-raised`.

## Two editing modes, never both

- Both use kit `TaskRow` + `CheckCircle`. `MOBILE` (`consts/media.ts`, the complement of the
  `DESKTOP` that mounts `PanelHost`), read once per list and passed down (`DaySection` →
  `DayTaskRow sheetEditing`; `AnytimeBlock`), picks the mode.
- Mobile: rows sit inside `SwipeActions` and open the `EditTask` sheet.
- Desktop: rows open `openPanel({ kind: "task", id, day })`, `day` = the instance's `date` for a
  recurring one (instances share the series id), none otherwise; the open row is `selected`
  (`aria-current`). Dated rows show hover/focus chips (`TaskRow actions`): time (the
  `DateTimePopover` wheel), day (`DayPopover`, keeps the clock) and a "more" menu (Abrir, Excluir).
  A read-only invite (`readonly` in the Calendar status) gets only "more": Google owns its time and
  day. Undated rows have no chips.
- The editor is `useTaskEditor` (`components/edit-task.tsx`), laid out by the sheet and by
  `PanelHost`'s `TaskPanel` (footer = Salvar/Concluir/Excluir). The panel looks the task up in
  `tasks`/`undatedTasks` and closes when it is gone (deleted, or a save that detached it).
- A recurring reschedule from a chip asks the scope (`RecurrenceScopeDialog`); the alert shifts by
  the same delta. Delete scope and Calendar-linked confirm are `useTaskActions().deleteDialog`,
  rendered by the caller. Per-row dialogs mount on first use.

## Composer

- `TaskComposer` mounts only inside `CreateFab` (`pages/home.tsx`), which also mounts `MewChat` (the
  dock). The dock's mic and `voiceSignal` (home's `?mew=voice`, the Android assistant, passed on
  as `MewChat listenSignal`) record a Mew chat turn; only the composer's own mic creates by voice.
  Mobile: a bottom `Sheet`.
  Desktop: a centered glass `Dialog`, opened by the toolbar's "Nova tarefa" (`openSignal`), `n`, a
  calendar day (`day`) or the first-run example or intro suggestion (`text`); `/` focuses the Mew
  input (`INPUT_ID`).
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
  the strip doesn't reflow per keystroke; `#tag` chips follow, remove-only (no `Edits` key: the ×
  ignores the tag's spans). `MetaChip` without `onRemove` only edits (`ghost` = the
  empty "+ x" look); without `editor` it only displays (an undated task's reminder). A task with a
  time edits its reminder with `ReminderMenu`, sent as `ComposerValues.before` (minutes).
- The textarea id is `COMPOSER_TEXT_ID` (`task-composer.tsx`), which `create-fab.tsx` focuses on
  open and after a calendar day pick.

## Chip editors (`task-meta-menus.tsx`)

- Shared by the composer and the desktop `DayTaskRow` chips, so `DayPicker` and `TimeWheel` also run on
  touch (the wheel scrolls natively there and drags by hand only for the mouse).
- Each takes its trigger as `children` under `*Trigger asChild`. Single choice is a
  `DropdownMenuRadioGroup`, never a nested Select; a Popover only when the panel holds an editor
  (text field, calendar, wheel), because a menu item closes on the first click.
- Popover editors buffer and call `onChange` once on close, only if changed: callers PATCH in
  `onChange` (`DayPopover` is pick-and-close). Option lists keep an off-grid current value
  (`functions/task-options.ts`, `everyOptions`) so it never snaps. Day and clock labels come from
  `functions/date-label.ts` (`clockAt`, `dayDot`, `dayComma`, `weekdayDate`, `weekOf`).

## TaskForm (`task-form.tsx`)

- A stack of pages (`FormView`: root/title/tags/links/meet); `edit-task.tsx` draws the header from
  `FORM_VIEWS[view].title`. Date, time and single-choice fields are native controls laid over a
  `ListRow` on the root (`NativeRow`), not pages.
- Dirty tracking compares JSON snapshots; links compare to `savedLinks`, so a server-saved Meet
  doesn't light "Salvar".
- `links` also carries the Google Calendar event URL (`isCalendarEventLink`). Editors touch only the
  task's own links and must re-append `calendarLinks`, or the task is unlinked from the calendar.
  When `task.links` changes under an open form (Add to Calendar), `rebaseLinks`
  (`functions/edit-input.ts`) replays the form's link edits over it.
- Undated: `date` only orders the list; the reminder is a day fired at `DEFAULT_HOUR` (09:00), shown
  through `undatedReminder`. Toggling undated carries the chosen day across.
- Agenda: the reminder is `before`, minutes from the alert to `date` (`reminderBefore`,
  `REMINDER_OFFSETS` in `functions/task-options.ts`), so a date or time edit keeps the distance.
  There is no wire field for it: every save and reschedule rebuilds `alert = date - before`.
- `locked` (a Calendar invite you don't organize) disables title, date, time, duration, the undated
  switch, repeat, interval and weekdays. Priority, tags and links stay editable. `useTaskEditor`
  computes it, so the sheet and the side panel lock alike.
- Weekly starts with the task's own weekday and `WeekdayToggle` won't drop the last day: an empty
  `Weekly` never fires (shared `normalizeRepeat` turns it into "Off"). `copy.form.repeatDays` and `copy.aside.weekDayInitials` are Sunday-first,
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
  undated tasks exist (also from an earlier `selectedDay`), because `AnytimeBlock` lives in today's section.
- The sentinel uses `rootMargin: "0px 0px 200% 0px"` and gives up after `MAX_EMPTY_MONTHS` (12)
  months without a task. The skeleton shows only at boot (`isLoading && !tasks`).
- `dayAnchorId(day)` = `day-yyyy-MM-dd`, absent in calendar mode. `DayList` scrolls to it when
  `targetDay` changes; a remount with the same target keeps the restored scroll.
- `useVisibleDay` picks the last section whose top crossed 64px, if it is in this week; a
  `targetDay` pins the pill until `touchstart`/`wheel`/`keydown`. It queries `section[data-day]`,
  which only anchored (non-calendar) sections carry.
- `dayLabel` uses `isSameWeek` with `weekStart`, the same week as the strip.
- `NowLine` sorts at `nowAt - 0.5`, so a task starting this minute sits below it. Only today uses
  `useNow(60_000)`. The row stagger runs only for today and the calendar day, so months loaded
  mid-scroll don't animate.
- Row order is `dayRows` (`day-rows.ts`): clock order, done tasks after the open ones and the now
  line. Rows are `layout="position"` inside `AnimatePresence`: a done task glides to the end, a new
  (`isSaving`) one enters at its slot (`enter` variant), a removed one slides left then collapses.
  `isDayZeroed` swaps the count for "Dia zerado" and pulses the heading once (WAAPI).
- New widget: a props-only View plus a container in the same file that reads `useDailify`, per-day
  tasks via `getTasksForDay` (never a hand filter), time via `useNow`, and writes through a `hooks/`
  action; a co-located render test.

## Drag to schedule (desktop)

- Undated rows drag with `DRAG_TYPE = "application/x-mewki-task"`; other drags are ignored. Mouse
  only: `NO_DRAG = "(max-width: 767px), (pointer: coarse)"` (`consts/media.ts`).
- `ScheduleDrop` wraps each `DaySection` and week pill; the child paints `data-drop-over:`. A drop
  opens a `TimeWheel` popover and only "Agendar" writes (`useUndatedActions().schedule`). The drop
  time is 09:00, or the next full hour (capped at 23) when today is past 09:00.
- `content-visibility` on sections is mobile-only: on desktop it clips the drop outline.

## SwipeActions (touch rows)

- Right completes, left deletes. The return is a hand-run spring and the action fires after it,
  because `dragSnapToOrigin` dies when `setTasks` re-renders the row (motion#636).
- `dragListener={false}`; the drag starts only outside 24px screen edges (`startsSwipe`, the system
  back gesture). `onClickCapture` swallows the click that ends a drag. `dragElastic={1}`.
- Fires past `min(25% of width, 96px)` or on a flick ≥400px/s that moved ≥24px. The panels are
  solid `success-soft(-strong)` and `brand-soft(-pressed)`, the second one when armed.

## Tests

- `task-composer.*.render` (chips, Mew, calendar tag, voice) run the real hooks, mock
  `@/functions/api`, `@/lib/auth`, `dailifyContext` and `sonner`, and need a `MemoryRouter`
  (`MewCard` links to `/premium`). `create-fab.render` mocks the hooks instead.
- `anytime-block.render` also covers today's undated `DayList`, `CheckHistory`, `useUndatedActions`
  and drag-drop. `day-section.render` pins the day labels and the now-line order. New cases go in
  the component's own file.
