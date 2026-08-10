import { type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Orbit } from "../orbit";
import { TagBadge } from "@/components/task-card";

const CADENCES = ["Diário", "Semanal", "Mensal"] as const;
const ACTIVE_CADENCE = 1; // "Semanal"
const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"] as const;
const ACTIVE_WEEKDAYS: ReadonlySet<number> = new Set([0]); // segunda — { Weekly: ["Monday"] }

/** Bloco rotulado (label mono + conteúdo) — estrutura repetida das seções do editor. */
function Section({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-2xs uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Pílula de cadência (a ativa em accent). */
function CadencePill({ label, active }: { label: string; active: boolean }): JSX.Element {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-2xs",
        active
          ? "border-accent-primary bg-accent-subtle text-accent-primary"
          : "border-surface-line text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** Card da task recorrente — ícone Orbit | title/tags | badge de cadência. */
function RecurringCard({ reduce }: { reduce: boolean }): JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-surface-line px-4 py-3">
      <Orbit
        size={36}
        animated={!reduce}
        className="shrink-0"
        ringClassName="stroke-muted-foreground"
        dotClassName="fill-muted-foreground"
        strokeWidth={3}
        dash={[3, 9]}
        headRadius={12}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-base font-semibold text-foreground">Reunião de time</span>
        <div className="flex gap-1.5">
          <TagBadge label="time" />
          <TagBadge label="sync" />
        </div>
      </div>
      <Badge
        variant="outline"
        className="shrink-0 border-accent-primary px-2.5 py-0.5 text-2xs font-normal text-accent-primary"
      >
        Semanal
      </Badge>
    </div>
  );
}

/**
 * "App window" do editor de recorrência — a task + cadência + dias da semana + horário/duração +
 * resumo da regra, preenchendo a janela de cima a baixo. Decorativo. O Orbit gira (respeita
 * reduced-motion). `className` controla o tamanho (default `h-152`).
 */
export function RecurrenceAppWindow({
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
          <span className="text-sm font-medium text-foreground">Recorrência</span>
        </div>
        <span className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
          Config
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-hidden p-6">
        <RecurringCard reduce={reduce} />

        <div className="h-px bg-surface-line" />

        <Section label="Cadência">
          <div className="flex gap-2">
            {CADENCES.map((c, i) => (
              <CadencePill key={c} label={c} active={i === ACTIVE_CADENCE} />
            ))}
          </div>
        </Section>

        <Section label="Repete em">
          <div className="flex gap-1.5">
            {WEEKDAYS.map((day, i) => (
              <span
                key={i}
                className={cn(
                  "flex-1 rounded-md border py-1.5 text-center font-mono text-2xs",
                  ACTIVE_WEEKDAYS.has(i)
                    ? "border-accent-primary bg-accent-subtle text-accent-primary"
                    : "border-surface-line text-muted-foreground",
                )}
              >
                {day}
              </span>
            ))}
          </div>
        </Section>

        <div className="flex gap-10">
          <Section label="Horário">
            <span className="font-mono text-sm text-foreground">10:00</span>
          </Section>
          <Section label="Duração">
            <span className="font-mono text-sm text-foreground">1h</span>
          </Section>
        </div>

        <div className="h-px bg-surface-line" />

        <Section label="Resumo">
          <span className="text-sm text-content-secondary">
            Toda segunda-feira, 10:00 · sem término
          </span>
        </Section>
      </div>
    </div>
  );
}
