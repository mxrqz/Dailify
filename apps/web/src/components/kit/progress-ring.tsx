import { cn } from "@/lib/utils";

/** Anel de 40px (trilho `fill`, progresso `brand`) com "feitas/total" no meio: o placar da Hoje. */
export function ProgressRing({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  /** O placar por extenso pro leitor de tela ("2 de 5 tarefas concluídas"). */
  label: string;
  className?: string;
}): JSX.Element {
  const done = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div role="img" aria-label={label} className={cn("relative size-10 flex-none", className)}>
      <svg viewBox="0 0 40 40" aria-hidden="true" className="size-10 -rotate-90">
        <circle cx="20" cy="20" r="17" fill="none" strokeWidth="4" className="stroke-fill" />
        {/* Com 0 a ponta redonda desenharia um ponto: sem progresso, sem arco. */}
        {done > 0 && (
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={`${done} 1`}
            className="stroke-brand"
          />
        )}
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums"
      >
        {value}/{max}
      </span>
    </div>
  );
}
