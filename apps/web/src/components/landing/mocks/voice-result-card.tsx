import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { TaskCard } from "../task-card";

/** Um slot da agenda (a nova tarefa em accent). */
function Slot({ time, title, active }: { time: string; title: string; active?: boolean }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <span className="w-11 shrink-0 text-right font-mono text-2xs text-muted-foreground">
        {time}
      </span>
      <span
        className={cn(
          "flex-1 truncate border-l-2 py-1 pl-3 text-xs",
          active
            ? "border-accent-primary font-medium text-foreground"
            : "border-surface-line text-content-secondary",
        )}
      >
        {title}
      </span>
    </div>
  );
}

/**
 * Card flutuante do resultado da voz — a fala virou uma TaskCard real estruturada e já encaixou no
 * seu dia (a nova em accent, com a linha do "agora"). Decorativo. `className` controla o tamanho.
 */
export function VoiceResultCard({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-4 overflow-hidden rounded-2xl border border-surface-line bg-surface-card p-5 shadow-panel",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded-full bg-accent-primary">
          <Check className="size-3 text-white" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium text-foreground">Tarefa criada</span>
      </div>

      <TaskCard
        time="14:00"
        title="Reunião com o time"
        duration="1h"
        tags={["time", "sync"]}
        selected
      />

      <div className="h-px bg-surface-line" />

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <span className="mb-1 text-2xs uppercase tracking-[0.08em] text-muted-foreground">
          No seu dia
        </span>
        <Slot time="09:00" title="Stand-up diário" />
        <Slot time="11:30" title="Escrever proposta" />
        <div className="flex items-center gap-3 py-0.5">
          <span className="w-11 shrink-0 text-right font-mono text-2xs text-accent-primary">
            agora
          </span>
          <span className="h-px flex-1 bg-accent-primary shadow-[0_0_8px_var(--accent-glow)]" />
        </div>
        <Slot time="14:00" title="Reunião com o time" active />
        <Slot time="15:30" title="Review de design" />
      </div>
    </div>
  );
}
