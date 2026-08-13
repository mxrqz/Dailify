import { Bell, Check, Clock, Flag, Repeat, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { priorityTextColor } from "@/consts/conts";
import { cn } from "@/lib/utils";
import { TagBadge } from "@/components/task-card";

/** Metadado compacto (ícone + label) — pill neutro. Decorativo. */
function Meta({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-surface-line px-2 py-1 text-2xs text-content-secondary">
      <Icon className={cn("size-3 shrink-0", iconClassName)} aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * "App window" da Sheet de detalhe da tarefa, em modo leitura — espelha o EditTask Sheet real:
 * título, data/hora/duração, descrição (o corpo), metadados (prioridade/repeat/lembrete), tags e
 * a ação. Decorativo e sem estado; preenche o wrapper posicionado (`h-full w-full`) e o
 * `rounded-t-2xl` vende a bottom-sheet deslizando de baixo. Espelha a task "Escrever proposta"
 * (11:00) que aparece na lista do <DayAppWindow> atrás — lê como "toquei nela → abriu o corpo".
 */
export function TaskDetailSheet(): JSX.Element {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-t-2xl border border-surface-line bg-surface-card shadow-panel">
      {/* grabber — assinatura de bottom-sheet */}
      <div className="flex shrink-0 justify-center pb-1 pt-3">
        <span className="h-1 w-9 rounded-full bg-surface-line" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 pb-6 pt-2">
        {/* título + data/hora/duração */}
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
            Escrever proposta
          </h3>
          <span className="inline-flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
            <Clock className="size-3 shrink-0" aria-hidden="true" />
            Ter · 8 Ago · 11:00 · 1h
          </span>
        </div>

        {/* descrição — o corpo da tarefa */}
        <p className="text-sm leading-relaxed text-content-secondary">
          Rascunho pro cliente Acme — escopo, entregáveis e timeline. Anexar o orçamento revisado
          antes de mandar.
        </p>

        {/* metadados */}
        <div className="flex flex-wrap gap-2">
          <Meta icon={Flag} iconClassName={priorityTextColor[3]}>
            Alta
          </Meta>
          <Meta icon={Repeat}>Não repete</Meta>
          <Meta icon={Bell}>30min antes</Meta>
        </div>

        {/* tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          <TagBadge label="deep work" />
          <TagBadge label="cliente" />
        </div>

        {/* ação */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-primary px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_16px_var(--accent-glow)]"
        >
          <Check className="size-4 shrink-0" aria-hidden="true" />
          Concluir
        </button>
      </div>
    </div>
  );
}
