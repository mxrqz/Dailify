import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Orbit } from "../orbit";
import { TagBadge } from "../task-card";
import { boxResolveMs, CROSSFADE_S } from "./timing";

/**
 * Cena "recorrência" (activeWord===2): como tarefas/horários, o config entra como skeleton (shimmer)
 * e resolve num crossfade — sincronizado com o box. O laço <Orbit> animado agora vive no BOX
 * (task-options) como skeleton dele. Conteúdo: card recorrente (ícone Orbit estático) + seletor de
 * cadência + preview das próximas ocorrências. `reduce` vai direto pro conteúdo.
 */

const EXPO = [0.16, 1, 0.3, 1] as const;

const CADENCES = ["Diário", "Semanal", "Mensal"] as const;
const ACTIVE_CAD = 1; // "Semanal" selecionada

interface Occurrence {
  date: string;
  time: string;
}
const PROXIMAS: readonly Occurrence[] = [
  { date: "seg, 4 ago", time: "10:00" },
  { date: "seg, 11 ago", time: "10:00" },
  { date: "seg, 18 ago", time: "10:00" },
] as const;

/** Meta pro widget de streak do box (task-options): semanas já feitas + próxima ocorrência. */
export const recorrenciaMeta = {
  streakWeeks: 8,
  next: PROXIMAS[0],
};

/** Pílula de cadência. */
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

/** Card da task recorrente — 3 colunas: ícone Orbit | (title/tags/regra) | badge. */
function RecurringCard(): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-surface-line px-4 py-3.5">
      <Orbit
        size={38}
        className="shrink-0 self-center"
        ringClassName="stroke-muted-foreground"
        dotClassName="fill-muted-foreground"
        gapDegrees={90}
        strokeWidth={3}
        dash={[3, 9]}
        headRadius={12}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-base font-semibold text-foreground">Reunião de time</span>
        <div className="flex gap-1.5">
          <TagBadge label="time" />
          <TagBadge label="sync" />
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">└</span>
          <span className="text-content-secondary">toda segunda · 10:00</span>
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

/** Preview das próximas ocorrências geradas (série da mesma task; a próxima em accent). */
function ProximasList(): JSX.Element {
  return (
    <div>
      <p className="mb-2 text-2xs uppercase tracking-[0.08em] text-muted-foreground">
        Próximas ocorrências
      </p>
      <div className="relative flex flex-col gap-0.5">
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
            <span className="ml-auto font-mono text-2xs text-muted-foreground">{o.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Conteúdo real do config (o crossfade da cena controla a opacidade). */
function ConfigContent(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <RecurringCard />
      <div className="flex gap-2">
        {CADENCES.map((c, i) => (
          <CadencePill key={c} label={c} active={i === ACTIVE_CAD} />
        ))}
      </div>
      <ProximasList />
    </div>
  );
}

/** Skeleton do config (placeholders com shimmer; cruza pro ConfigContent). */
function ConfigSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-lg border border-surface-line px-4 py-3.5">
        <span className="skeleton size-9 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="skeleton h-4 w-32 rounded" />
          <span className="skeleton h-3 w-20 rounded" />
        </div>
        <span className="skeleton h-5 w-16 shrink-0 rounded-full" />
      </div>
      <div className="flex gap-2">
        <span className="skeleton h-6 w-14 rounded-full" />
        <span className="skeleton h-6 w-16 rounded-full" />
        <span className="skeleton h-6 w-14 rounded-full" />
      </div>
      <div>
        <span className="skeleton mb-2 block h-2.5 w-24 rounded" />
        <div className="flex flex-col gap-2">
          <span className="skeleton h-3.5 w-40 rounded" />
          <span className="skeleton h-3.5 w-36 rounded" />
          <span className="skeleton h-3.5 w-40 rounded" />
        </div>
      </div>
    </div>
  );
}

export function SceneRecorrencia({ reduce }: { reduce: boolean }): JSX.Element {
  const [resolved, setResolved] = useState(reduce);

  useEffect(() => {
    if (reduce) return;
    setResolved(false);
    const t = setTimeout(() => setResolved(true), boxResolveMs(4)); // casa com o box (1260ms)
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div className="flex min-h-80 flex-col justify-center">
      <div className="grid pl-5">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1"
          initial={false}
          animate={{ opacity: resolved ? 0 : 1 }}
          transition={{ duration: CROSSFADE_S, ease: EXPO }}
        >
          <ConfigSkeleton />
        </motion.div>
        <motion.div
          className="col-start-1 row-start-1"
          initial={false}
          animate={{ opacity: resolved ? 1 : 0 }}
          transition={{ duration: CROSSFADE_S, ease: EXPO }}
        >
          <ConfigContent />
        </motion.div>
      </div>
    </div>
  );
}
