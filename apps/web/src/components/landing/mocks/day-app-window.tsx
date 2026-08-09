import { DayColumn } from "./day-column";

/** Realistic "app window" of the day view — window chrome + the day timeline. Decorative. */
export function DayAppWindow(): JSX.Element {
  return (
    <div className="flex h-152 w-full flex-col overflow-hidden rounded-2xl border border-surface-line bg-surface-card shadow-panel">
      <div className="flex items-center justify-between border-b border-surface-line px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-accent-primary shadow-[0_0_8px_var(--accent-glow)]" />
          <span className="text-sm font-medium text-foreground">Hoje</span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          Ter · 8 Ago
        </span>
      </div>
      <div className="min-h-0 flex-1 p-6">
        <DayColumn />
      </div>
    </div>
  );
}
