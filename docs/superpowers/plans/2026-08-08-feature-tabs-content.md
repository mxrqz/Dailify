# FeatureTabs Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill each FeatureTabs panel (Day / Calendário / Recorrência / Voz) with a layered, mastra-style product mockup — `[recurso em ação]` + `[resultado estruturado]` bleeding off the edges, copy pinned at the bottom.

**Architecture:** A new `<TabScene>` layout primitive holds N absolutely-positioned mockup layers (with "bleed" offsets, clipped by the panel's existing `overflow-hidden`) plus a bottom-centered copy block. Each tab composes real, reusable presentational components (existing `TaskCard`/`NowLine`/`Orbit`; new pure `MonthGrid`/`DayPeekCard`/`RecurrenceConfig`/`VoiceCapture`) — design-first, so the app redesign reuses them later. Ship the **DAY pilot first**, get visual approval, then replicate.

**Tech Stack:** React 18 + TypeScript, Tailwind v4 (design tokens), framer-motion, lucide-react. Package manager: **bun**.

## Global Constraints

- **No `as` type assertions** — use type guards / proper types. `as const` is fine. (ESLint warning; don't add new ones.)
- **Design tokens only** — no hex / arbitrary colors in components (`bg-surface-card`, `text-muted-foreground`, `border-surface-line`, `bg-tag-N`, `text-accent-primary`, …). Add a token + `@theme inline` mapping if a color is missing; never inline hex.
- **Prettier** printWidth 100. Full gate: `bun run check` (format:check + lint + typecheck + test). Per-step fast gate: `bun run typecheck` + `bun run lint`.
- **Decorative mockups are `aria-hidden`**; only the real copy (`h3` título + `p` blurb) stays in the a11y tree. Radix tab keyboard nav (arrow keys / roving tabindex) must stay intact.
- **New mockup components are pure/presentational** — props data-in, **no `useDailify`**, no context/network. They must be usable from both the landing and a future app redesign.
- Copy strings come from `copy.features.tabs.<key>` (`./copy`). Do not hardcode copy in components.
- Commit frequently (one per task minimum). Do **not** `git push` (standing user instruction).

## File Structure

- **Create** `apps/web/src/components/landing/tab-scene.tsx` — `<TabScene>` layout primitive (layers + bottom copy). One responsibility: composition/positioning.
- **Create** `apps/web/src/components/landing/mocks/day-column.tsx` — `<DayColumn>` pure day-timeline mock (times + `TaskCard`s + now divider).
- **Create** `apps/web/src/components/landing/mocks/month-grid.tsx` — `<MonthGrid>` pure month calendar + `buildMonthGrid()` data helper (+ test).
- **Create** `apps/web/src/components/landing/mocks/day-peek-card.tsx` — `<DayPeekCard>` day-of tasks popover mock.
- **Create** `apps/web/src/components/landing/mocks/recurrence-config.tsx` — `<RecurrenceConfig>` "Repetir ▸ Semanal" + weekday chips mock.
- **Create** `apps/web/src/components/landing/mocks/occurrences-strip.tsx` — `<OccurrencesStrip>` weeks strip with repeating/ghost occurrences.
- **Create** `apps/web/src/components/landing/mocks/voice-capture.tsx` — `<VoiceCapture>` waveform + live transcript mock.
- **Modify** `apps/web/src/components/landing/feature-tabs.tsx` — `TabPanel` renders `<TabScene>` per `tabKey`; delete the inline `DayMock`/`CalendarMock`/`RecurrenceMock`/`VoiceMock` and their mock-data consts once each tab is migrated.

> Reused as-is (read before wiring): `task-card.tsx` (`TaskCard`, `TaskCardData = {time,title,duration,tags[]}`, props `loading?`/`selected?`), `now-line.tsx` (`NowLine`, props `size?`/`animated?`/`speed?`), `orbit.tsx` (`Orbit`), `wave-form.tsx`, `ui/repeat-picker.tsx` (for styling cues only — do not pull app state).

## Verification convention (frontend)

Most tasks are presentational: their gate is **`bun run typecheck` + `bun run lint` green, then visual approval by print** (the app runs on `https://localhost:1420` via HMR). Only pure-logic helpers get a unit test (vitest, colocated `*.test.ts`). This matches the existing codebase (it tests logic — geometry/pricing/copy — not decorative JSX).

---

### Task 1: `<TabScene>` layout primitive

**Files:**
- Create: `apps/web/src/components/landing/tab-scene.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface TabSceneProps {
    title: string;
    blurb: string;
    children: React.ReactNode; // the mockup layers (absolutely positioned by the caller)
  }
  function TabScene(props: TabSceneProps): JSX.Element
  ```
- Consumes: nothing (pure layout). `cn` from `@/lib/utils`.

**Contract:** a `relative h-full w-full` container. `children` (the layers) render first, each caller-positioned `absolute` and free to bleed past the edges (the panel's `overflow-hidden` clips them). The copy block is `absolute inset-x-0 bottom-0`, centered, `z-20`, with a top-fade gradient scrim behind it (token bg) so text stays legible over busy mockups. Whole thing `aria-hidden` EXCEPT the copy.

- [ ] **Step 1: Write the component**

```tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TabSceneProps {
  title: string;
  blurb: string;
  /** Mockup layers — each positioned `absolute` by the caller; free to bleed off the edges. */
  children: ReactNode;
}

/**
 * Layout primitive for a feature-tab panel: caller-positioned mockup layers (which bleed past the
 * edges, clipped by the panel's overflow-hidden) with the copy pinned bottom-center over a fade
 * scrim. Layers are decorative (aria-hidden); only the copy stays in the a11y tree.
 */
export function TabScene({ title, blurb, children }: TabSceneProps): JSX.Element {
  return (
    <div className="relative h-full w-full">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 bg-gradient-to-t from-background via-background/85 to-transparent px-6 pb-8 pt-16 text-center">
        <h3 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{title}</h3>
        <p className="max-w-md text-sm text-muted-foreground">{blurb}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `cd apps/web && bun run typecheck && bun run lint`
Expected: 0 errors (warnings in unrelated files are fine).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/landing/tab-scene.tsx
git commit -m "feat(web): landing — <TabScene> layout primitive (camadas + copy embaixo)"
```

---

### Task 2: DAY pilot — wire `<TabScene>` + day mockup (VISUAL GATE)

**Files:**
- Create: `apps/web/src/components/landing/mocks/day-column.tsx`
- Modify: `apps/web/src/components/landing/feature-tabs.tsx` (replace `DayMock` usage in `TabPanel` with `<TabScene>` + layers for `tabKey === "day"`; keep other tabs on their old mocks for now)

**Interfaces:**
- Consumes: `TabScene` (Task 1); `TaskCard` + `TaskCardData` from `./task-card`; `NowLine` from `./now-line`.
- Produces:
  ```ts
  function DayColumn(props: { reduce: boolean }): JSX.Element
  ```

**Contract:** `<DayColumn>` is the back layer — a vertical day timeline: 3–4 `TaskCard`s (real component) separated by a "— agora —" now-divider (a horizontal accent line + `NowLine` glyph or the existing `agora` marker styling). Front layer (composed inline in `TabPanel`) = one `TaskCard` with `selected` emphasis, positioned bottom-right and bleeding off the right edge. `DayColumn` bleeds off the top/left.

- [ ] **Step 1: Write `DayColumn`**

```tsx
import { TaskCard, type TaskCardData } from "../task-card";

const DAY_EARLY: ReadonlyArray<TaskCardData> = [
  { time: "08:30", title: "Revisar PRs", duration: "45min", tags: ["dev", "review"] },
];
const DAY_LATE: ReadonlyArray<TaskCardData> = [
  { time: "11:00", title: "Escrever proposta", duration: "1h", tags: ["deep work"] },
  { time: "13:30", title: "Almoço com o time", duration: "1h", tags: ["pessoal"] },
];

/** Decorative day-timeline mock — real TaskCards split by the "agora" divider. Not wired to data. */
export function DayColumn({ reduce }: { reduce: boolean }): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {DAY_EARLY.map((t) => (
        <TaskCard key={t.time} {...t} />
      ))}
      <div className="flex items-center gap-3 py-0.5">
        <span className="w-12 shrink-0 text-right font-mono text-2xs text-accent-primary">agora</span>
        <span className="h-px flex-1 bg-accent-primary shadow-[0_0_10px_var(--accent-glow)]" />
      </div>
      {DAY_LATE.map((t) => (
        <TaskCard key={t.time} {...t} />
      ))}
    </div>
  );
}
```

(`reduce` is accepted for signature parity with the other scenes even if unused here; if lint flags it unused, prefix `_reduce` or drop it — decide at implementation.)

- [ ] **Step 2: Wire DAY into `TabPanel`**

In `feature-tabs.tsx`, import `TabScene` and `DayColumn`. In `TabPanel`, for `tabKey === "day"` render:

```tsx
<TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
  {/* back layer: day timeline, bleeding top/left */}
  <div className="absolute -left-6 -top-8 w-[22rem] max-w-[70%] md:w-[26rem]">
    <DayColumn reduce={reduce} />
  </div>
  {/* front layer: one emphasised card, bleeding off the right */}
  <div className="absolute -right-6 top-24 w-72 md:w-80">
    <TaskCard time="16:00" title="Deploy da landing" duration="30min" tags={["dev", "prio"]} selected />
  </div>
</TabScene>
```

Keep the existing top-copy + `TabMock` path for the other three tabs (branch on `tabKey`, or leave `TabMock` for non-day and only DAY uses `TabScene`). The `motion.div` wrapper in `TabPanel` stays (crossfade). Remove the top `h3/p` block ONLY for the DAY branch (TabScene owns the copy).

- [ ] **Step 3: Typecheck + lint**

Run: `cd apps/web && bun run typecheck && bun run lint`
Expected: 0 errors.

- [ ] **Step 4: VISUAL GATE — approve the pilot**

Look at DAY on `https://localhost:1420` (HMR). Confirm: layers bleed off the edges and get clipped by the panel; copy sits legibly at the bottom over the fade; grain still shows behind; other tabs unchanged. Tune bleed offsets / widths until it reads like the reference. **Get user approval before Task 3.**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/landing/mocks/day-column.tsx apps/web/src/components/landing/feature-tabs.tsx
git commit -m "feat(web): FeatureTabs — DAY em camadas via <TabScene> (piloto)"
```

---

### Task 3: CALENDÁRIO panel

**Files:**
- Create: `apps/web/src/components/landing/mocks/month-grid.tsx` (+ `month-grid.test.ts`)
- Create: `apps/web/src/components/landing/mocks/day-peek-card.tsx`
- Modify: `apps/web/src/components/landing/feature-tabs.tsx` (calendar branch → `<TabScene>`)

**Interfaces:**
- Produces:
  ```ts
  // Monday-start month grid, leading/trailing nulls for padding.
  function buildMonthGrid(daysInMonth: number, firstWeekdayMon0: number): ReadonlyArray<number | null>
  interface MonthGridProps { today: number; busyDays: ReadonlySet<number>; }
  function MonthGrid(props: MonthGridProps): JSX.Element
  function DayPeekCard(props: { day: number; tasks: ReadonlyArray<{ time: string; title: string }> }): JSX.Element
  ```

**Contract:** `MonthGrid` = weekday header (SEG…DOM) + 7-col grid; each day is a cell with the number, `today` highlighted (`bg-accent-primary text-primary-foreground` pill), `busyDays` get an accent dot under them. Reuse the exact token classes from the current `CalendarMock` in `feature-tabs.tsx`. `DayPeekCard` = a small `bg-surface-card border-surface-line rounded-xl` card titled with the day + a short list of `time · title` rows (mirrors the day-peek popover the app will have).

- [ ] **Step 1: Write the failing test for `buildMonthGrid`**

```ts
// month-grid.test.ts
import { describe, expect, it } from "vitest";
import { buildMonthGrid } from "./month-grid";

describe("buildMonthGrid", () => {
  it("pads leading blanks to the first weekday (Monday-start) and fills the month", () => {
    const g = buildMonthGrid(30, 2); // month starts on Wednesday (Mon=0 → Wed=2)
    expect(g.slice(0, 2)).toEqual([null, null]);
    expect(g[2]).toBe(1);
    expect(g.filter((d) => d !== null)).toHaveLength(30);
    expect(g.length % 7).toBe(0); // whole weeks
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd apps/web && bun run test -- month-grid`
Expected: FAIL (`buildMonthGrid` not exported).

- [ ] **Step 3: Implement `month-grid.tsx`**

```tsx
import { cn } from "@/lib/utils";

const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"] as const;

/** Monday-start month grid: `firstWeekdayMon0` leading nulls, then 1..daysInMonth, then trailing nulls to fill whole weeks. */
export function buildMonthGrid(
  daysInMonth: number,
  firstWeekdayMon0: number,
): ReadonlyArray<number | null> {
  const cells: Array<number | null> = [];
  for (let i = 0; i < firstWeekdayMon0; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface MonthGridProps {
  today: number;
  busyDays: ReadonlySet<number>;
}

export function MonthGrid({ today, busyDays }: MonthGridProps): JSX.Element {
  const cells = buildMonthGrid(30, 2);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="text-center font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
          >
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 py-0.5">
            {day !== null && (
              <>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full font-mono text-xs",
                    day === today ? "bg-accent-primary text-primary-foreground" : "text-foreground",
                  )}
                >
                  {day}
                </span>
                <span
                  className={cn(
                    "size-1 rounded-full",
                    busyDays.has(day) ? "bg-accent-primary" : "bg-transparent",
                  )}
                />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify pass**

Run: `cd apps/web && bun run test -- month-grid`
Expected: PASS.

- [ ] **Step 5: Write `day-peek-card.tsx`**

```tsx
interface DayPeekCardProps {
  day: number;
  tasks: ReadonlyArray<{ time: string; title: string }>;
}

/** Decorative "peek do dia" popover — the day's tasks at a glance. */
export function DayPeekCard({ day, tasks }: DayPeekCardProps): JSX.Element {
  return (
    <div className="w-64 rounded-xl border border-surface-line bg-surface-card p-4 shadow-panel">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-medium text-foreground">Dia {day}</span>
        <span className="font-mono text-2xs text-muted-foreground">{tasks.length} tarefas</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <div key={t.time} className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-right font-mono text-2xs text-muted-foreground">
              {t.time}
            </span>
            <span className="flex-1 truncate border-l-2 border-surface-line pl-2 text-sm text-foreground">
              {t.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Wire CALENDÁRIO into `TabPanel`** (calendar branch → `<TabScene>`)

```tsx
<TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
  <div className="absolute -right-4 -top-6 w-[24rem] max-w-[75%] md:w-[28rem]">
    <MonthGrid today={14} busyDays={new Set([3, 7, 8, 12, 17, 22, 27])} />
  </div>
  <div className="absolute -left-4 bottom-28">
    <DayPeekCard
      day={17}
      tasks={[
        { time: "09:00", title: "Standup" },
        { time: "14:00", title: "Ligar pro cliente" },
        { time: "18:30", title: "Academia" },
      ]}
    />
  </div>
</TabScene>
```

- [ ] **Step 7: Typecheck + lint, then VISUAL GATE**

Run: `cd apps/web && bun run typecheck && bun run lint`. Then approve CALENDÁRIO by print (grid bleeds top-right, peek card bleeds bottom-left, copy legible). Tune offsets.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/landing/mocks/month-grid.tsx apps/web/src/components/landing/mocks/month-grid.test.ts apps/web/src/components/landing/mocks/day-peek-card.tsx apps/web/src/components/landing/feature-tabs.tsx
git commit -m "feat(web): FeatureTabs — CALENDÁRIO em camadas (MonthGrid + DayPeekCard)"
```

---

### Task 4: RECORRÊNCIA panel

**Files:**
- Create: `apps/web/src/components/landing/mocks/recurrence-config.tsx`
- Create: `apps/web/src/components/landing/mocks/occurrences-strip.tsx`
- Modify: `apps/web/src/components/landing/feature-tabs.tsx` (recurrence branch → `<TabScene>`)

**Interfaces:**
- Consumes: `Orbit` from `../orbit` (read its props before use).
- Produces:
  ```ts
  function RecurrenceConfig(props: { active: "Diário" | "Semanal" | "Mensal"; weekdaysSel: ReadonlyArray<boolean> }): JSX.Element
  function OccurrencesStrip(props: { reduce: boolean }): JSX.Element
  ```

**Contract:** `RecurrenceConfig` = a small config card: a row "Repetir" with three segmented chips (`Diário`/`Semanal`/`Mensal`, `active` highlighted `bg-accent-primary text-primary-foreground`, others `border-surface-line text-muted-foreground`) + a weekday row of 7 round chips (S T Q Q S S D) with `weekdaysSel` ones filled accent. Mirror `ui/repeat-picker.tsx` styling but standalone (no app state). `OccurrencesStrip` = 3–4 mini "week" rows where the same task pill repeats on the selected weekday, past occurrences as `bg-muted-foreground/40` ghosts and the next as solid accent; optionally an `<Orbit>` glyph as accent. Back layer = `RecurrenceConfig` (bleeds left), front = `OccurrencesStrip` (bleeds right).

- [ ] **Step 1: Write `recurrence-config.tsx`**

```tsx
import { cn } from "@/lib/utils";

const MODES = ["Diário", "Semanal", "Mensal"] as const;
const WD = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

interface RecurrenceConfigProps {
  active: (typeof MODES)[number];
  weekdaysSel: ReadonlyArray<boolean>;
}

/** Decorative recurrence config mock — segmented mode + weekday chips. Not wired to state. */
export function RecurrenceConfig({ active, weekdaysSel }: RecurrenceConfigProps): JSX.Element {
  return (
    <div className="w-72 rounded-xl border border-surface-line bg-surface-card p-4 shadow-panel">
      <span className="mb-3 block text-xs font-medium uppercase tracking-[0.04em] text-muted-foreground">
        Repetir
      </span>
      <div className="mb-4 flex gap-2">
        {MODES.map((m) => (
          <span
            key={m}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-2xs uppercase",
              m === active
                ? "border-transparent bg-accent-primary text-primary-foreground"
                : "border-surface-line text-muted-foreground",
            )}
          >
            {m}
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        {WD.map((d, i) => (
          <span
            key={i}
            className={cn(
              "flex size-7 items-center justify-center rounded-full font-mono text-2xs",
              weekdaysSel[i]
                ? "bg-accent-primary text-primary-foreground"
                : "border border-surface-line text-muted-foreground",
            )}
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `occurrences-strip.tsx`**

```tsx
import { cn } from "@/lib/utils";

const WEEKS = 4;
const DAYS = 7;
const SEL_DAY = 2; // repeats on this weekday
const NEXT_WEEK = 2; // rows before this are past (ghost), this one is next (solid), after are future (faint)

/** Decorative strip: the same task repeating weekly — past ghosts, next solid accent. */
export function OccurrencesStrip({ reduce: _reduce }: { reduce: boolean }): JSX.Element {
  return (
    <div className="flex w-80 flex-col gap-2">
      {Array.from({ length: WEEKS }).map((_, w) => (
        <div key={w} className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: DAYS }).map((__, d) => (
            <span
              key={d}
              className={cn(
                "h-6 rounded-md",
                d === SEL_DAY
                  ? w < NEXT_WEEK
                    ? "bg-muted-foreground/30"
                    : w === NEXT_WEEK
                      ? "bg-accent-primary shadow-[0_0_10px_var(--accent-glow)]"
                      : "bg-accent-primary/30"
                  : "bg-surface-line/40",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

(If the `/opacity` utilities conflict with the "prefer solid tokens" rule for a given element, swap for a solid token — decide at implementation; these are decorative non-interactive marks so opacity is acceptable, matching the existing `RecurrenceMock` ghosts.)

- [ ] **Step 3: Wire RECORRÊNCIA into `TabPanel`**

```tsx
<TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
  <div className="absolute -left-6 top-10">
    <RecurrenceConfig active="Semanal" weekdaysSel={[false, true, false, true, false, false, false]} />
  </div>
  <div className="absolute -right-6 top-28">
    <OccurrencesStrip reduce={reduce} />
  </div>
</TabScene>
```

- [ ] **Step 4: Typecheck + lint, then VISUAL GATE**

Run: `cd apps/web && bun run typecheck && bun run lint`. Approve by print (config bleeds left, strip bleeds right, next occurrence glows). Tune.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/landing/mocks/recurrence-config.tsx apps/web/src/components/landing/mocks/occurrences-strip.tsx apps/web/src/components/landing/feature-tabs.tsx
git commit -m "feat(web): FeatureTabs — RECORRÊNCIA em camadas (config + ocorrências)"
```

---

### Task 5: VOZ panel

**Files:**
- Create: `apps/web/src/components/landing/mocks/voice-capture.tsx`
- Modify: `apps/web/src/components/landing/feature-tabs.tsx` (voice branch → `<TabScene>`)

**Interfaces:**
- Consumes: `TaskCard` from `../task-card`. (Optionally read `wave-form.tsx` for waveform styling; a lightweight inline bar waveform like the current `VoiceMock` is fine and lighter — prefer it unless the real one is trivial to reuse.)
- Produces:
  ```ts
  function VoiceCapture(props: { transcript: string; reduce: boolean }): JSX.Element
  ```

**Contract:** `VoiceCapture` = a capture card: an animated bar waveform (reuse the `WAVE_HEIGHTS` pulse from the current `VoiceMock`, gated by `reduce`) + the live `transcript` text below (mono, muted). Back layer = `VoiceCapture` (bleeds left), front = the structured `TaskCard` the AI produced (bleeds right) — the "virou tarefa" payoff.

- [ ] **Step 1: Write `voice-capture.tsx`**

```tsx
import { motion } from "framer-motion";

const WAVE = [8, 14, 22, 30, 20, 26, 14, 10, 18, 12, 24, 16] as const;

interface VoiceCaptureProps {
  transcript: string;
  reduce: boolean;
}

/** Decorative voice-capture mock — animated waveform + the spoken transcript. */
export function VoiceCapture({ transcript, reduce }: VoiceCaptureProps): JSX.Element {
  return (
    <div className="w-80 rounded-xl border border-surface-line bg-surface-card p-4 shadow-panel">
      <div className="flex h-16 items-end gap-1" aria-hidden="true">
        {WAVE.map((h, i) => (
          <motion.span
            key={i}
            className="w-1.5 rounded-full bg-accent-primary"
            style={{ height: h, transformOrigin: "bottom" }}
            animate={reduce ? undefined : { scaleY: [1, 1.6, 1] }}
            transition={
              reduce ? undefined : { duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.06 }
            }
          />
        ))}
      </div>
      <p className="mt-3 font-mono text-2xs text-muted-foreground">"{transcript}"</p>
    </div>
  );
}
```

- [ ] **Step 2: Wire VOZ into `TabPanel`**

```tsx
<TabScene title={tabCopy.title} blurb={tabCopy.blurb}>
  <div className="absolute -left-6 top-12">
    <VoiceCapture transcript="amanhã 14h, ligar pro dentista, 30 minutos" reduce={reduce} />
  </div>
  <div className="absolute -right-6 top-28 w-80">
    <TaskCard time="14:00" title="Ligar pro dentista" duration="30min" tags={["pessoal", "saúde"]} selected />
  </div>
</TabScene>
```

- [ ] **Step 3: Typecheck + lint, then VISUAL GATE**

Run: `cd apps/web && bun run typecheck && bun run lint`. Approve by print. Tune offsets.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/landing/mocks/voice-capture.tsx apps/web/src/components/landing/feature-tabs.tsx
git commit -m "feat(web): FeatureTabs — VOZ em camadas (captura + tarefa estruturada)"
```

---

### Task 6: Cleanup + full gate

**Files:**
- Modify: `apps/web/src/components/landing/feature-tabs.tsx`

**Contract:** every tab now uses `<TabScene>`, so the old inline mocks are dead. Remove `DayMock`, `CalendarMock`, `RecurrenceMock`, `VoiceMock`, `TabMock`, and their mock-data consts (`dayMockEarly`, `MONTH_DAYS`, `RECURRENCE_GHOST_ANGLES`, `WAVE_HEIGHTS`, etc.). Simplify `TabPanel` so it renders the per-tab `<TabScene>` directly (a small `switch (tabKey)` returning the layer set). Keep the `TabsContent forceMount` + `motion.div` crossfade + `usePresence` a11y handling intact.

- [ ] **Step 1: Delete dead mocks and route `TabPanel` through a single `<TabScene>` switch**

Replace the body-composition part of `TabPanel` with a `switch (tabKey)` that returns the layers for each tab (moved verbatim from Tasks 2–5), wrapped once in `<TabScene title={tabCopy.title} blurb={tabCopy.blurb}>`. Delete the now-unused `TabMock` and every `*Mock` function + its consts.

- [ ] **Step 2: Full gate**

Run: `cd apps/web && bun run check`
Expected: format + lint + typecheck + test all green. Fix any fallout (unused imports from deleted mocks, `feature-tabs.test.ts` still passing).

- [ ] **Step 3: Final visual pass**

Print all four tabs; confirm switching still crossfades, keyboard nav works, grain + shell intact, no console errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/landing/feature-tabs.tsx
git commit -m "refactor(web): FeatureTabs — remove mocks antigos, tudo via <TabScene>"
```

---

## Self-Review

- **Spec coverage:** pattern/`TabScene` → Task 1; DAY → Task 2; CALENDÁRIO → Task 3; RECORRÊNCIA → Task 4; VOZ → Task 5; "remove *Mock" + gate → Task 6. Pure/reusable components (no `useDailify`) → every new file in `mocks/`. Copy from `copy.ts` → passed as `tabCopy.title/blurb`. Reduced-motion → `reduce` threaded into `DayColumn`/`OccurrencesStrip`/`VoiceCapture`; static scenes need nothing. a11y `aria-hidden` on layers → `TabScene`. Bleed clipped by panel `overflow-hidden` → relies on the existing content-region class in `feature-tabs.tsx` (verify it still has `overflow-hidden` when wiring Task 2). All covered.
- **Placeholder scan:** no TBD/TODO; every component has real JSX; the only deferred micro-decisions (`reduce` unused param, `/opacity` vs solid token) are called out with a concrete default. OK.
- **Type consistency:** `TaskCardData = {time,title,duration,tags[]}` used consistently; `TabScene({title,blurb,children})` consumed the same way in Tasks 2–5; `buildMonthGrid(daysInMonth, firstWeekdayMon0)` defined and tested in Task 3. Consistent.
