import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type Status = "done" | "next" | "upcoming";
const SERIES: ReadonlyArray<{ date: string; status: Status }> = [
  { date: "seg, 21 jul", status: "done" },
  { date: "seg, 28 jul", status: "done" },
  { date: "seg, 4 ago", status: "done" },
  { date: "seg, 11 ago", status: "next" },
  { date: "seg, 18 ago", status: "upcoming" },
  { date: "seg, 25 ago", status: "upcoming" },
];

const STATS = [
  { value: "8", label: "feitas" },
  { value: "12", label: "geradas" },
  { value: "3d", label: "próxima" },
] as const;

/** Marcador da ocorrência: ✓ concluída, ● próxima (accent+glow), ○ agendada. */
function Marker({ status }: { status: Status }): JSX.Element {
  if (status === "done")
    return <Check className="size-3 text-muted-foreground" aria-hidden="true" />;
  if (status === "next")
    return (
      <span className="size-2 rounded-full bg-accent-primary shadow-[0_0_6px_var(--accent-glow)]" />
    );
  return <span className="size-1.5 rounded-full border border-muted-foreground" />;
}

/**
 * Card flutuante da série recorrente — identifica a task, resume em números (feitas / geradas /
 * próxima) e mostra a linha do tempo (concluídas ✓ → próxima ● → agendadas ○). Prova visual do
 * "roda sozinho". Decorativo. `className` controla o tamanho.
 */
export function OccurrencesCard({ className }: { className?: string }): JSX.Element {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-4 overflow-hidden rounded-2xl border border-surface-line bg-surface-card p-6 shadow-panel",
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">Série</span>
        <span className="text-base font-semibold text-foreground">Reunião de time</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-0.5 rounded-lg border border-surface-line px-3 py-2.5"
          >
            <span className="text-lg font-semibold leading-none text-foreground">{s.value}</span>
            <span className="text-2xs uppercase tracking-[0.04em] text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="h-px bg-surface-line" />

      <div className="flex min-h-0 flex-1 flex-col">
        <span className="mb-2.5 text-2xs uppercase tracking-[0.08em] text-muted-foreground">
          Linha do tempo
        </span>
        <div className="relative flex flex-col gap-1">
          {/* conector tracejado ligando os marcadores (por baixo) */}
          <span
            aria-hidden
            className="absolute bottom-3 left-2 top-3 border-l border-dashed border-surface-line"
          />
          {SERIES.map((o) => (
            <div
              key={o.date}
              className={cn(
                "relative flex items-center gap-2.5 py-1 text-xs",
                o.status === "done" && "text-muted-foreground",
                o.status === "next" && "font-medium text-foreground",
                o.status === "upcoming" && "text-content-secondary",
              )}
            >
              <span className="flex w-4 shrink-0 items-center justify-center">
                <Marker status={o.status} />
              </span>
              <span>{o.date}</span>
              <span className="font-mono text-2xs text-muted-foreground">· 10:00</span>
              {o.status === "next" && (
                <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-2xs text-accent-primary">
                  próxima
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
