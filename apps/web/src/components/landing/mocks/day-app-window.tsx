import { cn } from "@/lib/utils";
import { DayColumn } from "./day-column";

/**
 * "App window" da visão de dia — chrome + timeline (`DayColumn`). Decorativo.
 * `date` é o label do header e `className` controla o tamanho (default `h-152`), então serve tanto
 * como janela grande (tab Day) quanto como peek menor (tab Calendar).
 */
export function DayAppWindow({
  date = "Ter · 8 Ago",
  className,
}: {
  date?: string;
  className?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-2xl border border-surface-line bg-surface-card shadow-panel",
        className ?? "h-152",
      )}
    >
      <div className="flex items-center justify-between border-b border-surface-line px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="size-2 rounded-full bg-accent-primary shadow-[0_0_8px_var(--accent-glow)]" />
          <span className="text-sm font-medium text-foreground">Hoje</span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          {date}
        </span>
      </div>
      <div className="min-h-0 flex-1 p-6">
        <DayColumn />
      </div>
    </div>
  );
}
