import { motion } from "framer-motion";
import { CalendarDays, Clock, Flag, Hash, Mic, Timer, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Alturas das barras do waveform (px) — muitas e finas, pulsam em loop pra sugerir a captura. */
const WAVE_HEIGHTS = Array.from({ length: 40 }, (_, i) => 5 + ((i * 7) % 12));

/** Campos que o Dailify extrai da fala (o "estrutura horário, duração e prioridade"). */
const FIELDS: ReadonlyArray<{ icon: LucideIcon; label: string; value: string; accent?: boolean }> =
  [
    { icon: CalendarDays, label: "Data", value: "amanhã · Ter, 12 ago" },
    { icon: Clock, label: "Horário", value: "14:00" },
    { icon: Timer, label: "Duração", value: "1h" },
    { icon: Flag, label: "Prioridade", value: "Alta", accent: true },
    { icon: Hash, label: "Tags", value: "time" },
  ];

/** Trecho reconhecido, destacado dentro da transcrição. */
function Hl({ children }: { children: string }): JSX.Element {
  return <span className="rounded bg-accent-subtle px-1 text-accent-primary">{children}</span>;
}

/**
 * "App window" da captura por voz — mic + waveform ao vivo, a transcrição com os trechos
 * reconhecidos destacados e os campos que o Dailify extrai. Decorativo (não plugado no fluxo real).
 * O waveform respeita reduced-motion. `className` controla o tamanho (default `h-152`).
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

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-6">
        {/* strip de gravação: mic + waveform + timer */}
        <div className="flex items-center gap-3 rounded-lg border border-surface-line px-3 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-primary shadow-[0_0_16px_var(--accent-glow)]">
            <Mic className="size-4 text-white" aria-hidden="true" />
          </div>
          <div className="flex h-8 flex-1 items-center justify-between" aria-hidden="true">
            {WAVE_HEIGHTS.map((height, index) => (
              <motion.span
                key={index}
                className="w-0.5 rounded-full bg-accent-primary"
                style={{ height, transformOrigin: "center" }}
                animate={reduce ? undefined : { scaleY: [1, 1.7, 1] }}
                transition={
                  reduce
                    ? undefined
                    : { duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: index * 0.04 }
                }
              />
            ))}
          </div>
          <span className="shrink-0 font-mono text-2xs text-muted-foreground">0:07</span>
        </div>

        {/* transcrição com trechos reconhecidos */}
        <div className="flex flex-col gap-1.5">
          <span className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">
            Transcrição
          </span>
          <p className="text-sm leading-relaxed text-foreground">
            Reunião com o time <Hl>amanhã</Hl> às <Hl>14h</Hl>, por <Hl>1 hora</Hl>, prioridade{" "}
            <Hl>alta</Hl>
          </p>
        </div>

        <div className="h-px bg-surface-line" />

        {/* campos detectados */}
        <div className="flex flex-col gap-3">
          <span className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">
            Detectado
          </span>
          {FIELDS.map(({ icon: Icon, label, value, accent }) => (
            <div key={label} className="flex items-center gap-2.5 text-sm">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">{label}</span>
              <span
                className={cn(
                  "ml-auto font-medium",
                  accent ? "text-accent-primary" : "text-foreground",
                )}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
