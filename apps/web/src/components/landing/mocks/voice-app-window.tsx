import { motion } from "framer-motion";
import { Mic } from "lucide-react";

import { cn } from "@/lib/utils";

/** Barras do waveform (px) — pulsam em loop pra sugerir a captura. */
const WAVE_HEIGHTS = [8, 14, 22, 30, 20, 26, 14, 10, 18, 12, 24, 16, 28, 12, 20, 10, 22] as const;

/**
 * "App window" da captura de tarefa por voz — mic + waveform pulsando + o que foi dito. Decorativo
 * (não plugado no fluxo real). O waveform respeita reduced-motion. `className` controla o tamanho.
 */
export function VoiceAppWindow({
  reduce,
  className,
}: {
  reduce: boolean;
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
          <span className="text-sm font-medium text-foreground">Nova tarefa por voz</span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          Gravando
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 p-6">
        <div className="flex size-20 items-center justify-center rounded-full bg-accent-primary shadow-[0_0_24px_var(--accent-glow)]">
          <Mic className="size-8 text-white" aria-hidden="true" />
        </div>

        <div className="flex h-16 items-end gap-1" aria-hidden="true">
          {WAVE_HEIGHTS.map((height, index) => (
            <motion.span
              key={index}
              className="w-1.5 rounded-full bg-accent-primary"
              style={{ height, transformOrigin: "bottom" }}
              animate={reduce ? undefined : { scaleY: [1, 1.6, 1] }}
              transition={
                reduce
                  ? undefined
                  : { duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: index * 0.06 }
              }
            />
          ))}
        </div>

        <p className="max-w-xs text-center text-sm text-content-secondary">
          “Reunião com o time amanhã às 14h, 1 hora, prioridade alta”
        </p>
      </div>
    </div>
  );
}
