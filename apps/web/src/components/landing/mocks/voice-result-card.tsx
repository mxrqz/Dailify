import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { TaskCard } from "../task-card";

/**
 * Card flutuante do resultado da voz — o que a fala virou: uma TaskCard real estruturada (horário,
 * duração, tags). Decorativo. `className` controla o tamanho.
 */
export function VoiceResultCard({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        "flex w-full flex-col justify-center gap-3 overflow-hidden rounded-2xl border border-surface-line bg-surface-card p-5 shadow-panel",
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
    </div>
  );
}
