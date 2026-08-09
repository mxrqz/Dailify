import { cn } from "@/lib/utils";

const PROXIMAS = [
  { date: "seg, 4 ago", time: "10:00" },
  { date: "seg, 11 ago", time: "10:00" },
  { date: "seg, 18 ago", time: "10:00" },
] as const;

/**
 * Card flutuante das próximas ocorrências geradas — a série "rodando sozinha" (a próxima em accent,
 * conector tracejado ligando os dots). Decorativo. `className` controla o tamanho.
 */
export function OccurrencesCard({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        "flex w-full flex-col justify-center overflow-hidden rounded-2xl border border-surface-line bg-surface-card p-6 shadow-panel",
        className,
      )}
    >
      <p className="mb-3 text-2xs uppercase tracking-[0.08em] text-muted-foreground">
        Próximas ocorrências
      </p>
      <div className="relative flex flex-col gap-1">
        {/* conector tracejado ligando as ocorrências (dots por cima) */}
        <span
          aria-hidden
          className="absolute bottom-2 left-0.75 top-2 border-l border-dashed border-surface-line"
        />
        {PROXIMAS.map((o, i) => (
          <div
            key={o.date}
            className={cn(
              "relative flex items-center gap-2.5 py-1 text-xs",
              i === 0 ? "text-foreground" : "text-content-secondary",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                i === 0
                  ? "bg-accent-primary shadow-[0_0_6px_var(--accent-glow)]"
                  : "border border-muted-foreground",
              )}
            />
            <span>{o.date}</span>
            <span className="font-mono text-2xs text-muted-foreground">· {o.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
