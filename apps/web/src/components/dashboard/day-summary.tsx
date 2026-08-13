import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { getNextTask } from "@/functions/functions";
import { cn } from "@/lib/utils";

/** Bloco do resumo: cartão `surface-card` com hairline, o degrau acima do shell. */
function SummaryCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className={cn("rounded-2xl border border-surface-line bg-surface-card p-5", className)}>
      {children}
    </div>
  );
}

/**
 * Faixa do topo: calendário à esquerda e o que vem a seguir logo ao lado. Os dois cartões têm
 * largura própria e ficam encostados um no outro — nada de `justify-between` jogando um pra
 * cada ponta.
 *
 * "Próxima tarefa" olha o MÊS inteiro (`currentMonthTasks`), não o dia selecionado — é o que dá
 * utilidade ao bloco justamente quando o dia aberto está vazio.
 */
export function DaySummary(): JSX.Element {
  const { currentMonthTasks } = useDailify();
  const nextTask = currentMonthTasks ? getNextTask(currentMonthTasks) : undefined;

  return (
    <aside className="flex flex-wrap items-start gap-4">
      <SummaryCard className="w-[19rem] shrink-0">
        <MiniCalendar />
      </SummaryCard>

      <SummaryCard className="w-[20rem] shrink-0">
        <div className="flex flex-col gap-3">
          <h2 className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground">
            {copy.aside.nextTaskLabel}
          </h2>

          {nextTask ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">{nextTask.title}</span>
              <span className="font-mono text-2xs text-muted-foreground">
                {format(new Date(nextTask.date), "EEE · d MMM · HH:mm", { locale: ptBR })}
              </span>
            </div>
          ) : (
            <p className="text-sm text-content-secondary">{copy.aside.noNextTask}</p>
          )}
        </div>
      </SummaryCard>
    </aside>
  );
}
