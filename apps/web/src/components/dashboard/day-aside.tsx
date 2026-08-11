import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import NewTask from "@/components/new-task";
import NewTaskVoice from "@/components/new-task-voice";
import { getNextTask } from "@/functions/functions";

/** Bloco do aside: cartão `surface-card` com hairline, o degrau acima do shell. */
function AsideCard({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-2xl border border-surface-line bg-surface-card p-5">{children}</div>
  );
}

/**
 * Coluna direita da view do dia: navegação por data, o que vem a seguir, e as ações de criação.
 * Substitui o `select-day.tsx`, que empilhava calendário, dois botões quadrados e um card
 * "Upcoming Task" numa grid de duas linhas.
 *
 * "Próxima tarefa" olha o MÊS inteiro (`currentMonthTasks`), não o dia selecionado — é o que dá
 * utilidade ao bloco justamente quando o dia aberto está vazio.
 */
export function DayAside(): JSX.Element {
  const { currentMonthTasks } = useDailify();
  const nextTask = currentMonthTasks ? getNextTask(currentMonthTasks) : undefined;

  return (
    <aside className="flex flex-col gap-4 self-start">
      <AsideCard>
        <MiniCalendar />
      </AsideCard>

      <AsideCard>
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
      </AsideCard>

      <div className="flex items-center gap-2">
        <NewTask className="h-10 w-full rounded-full bg-accent-primary text-primary-foreground hover:bg-accent-hover" />
        <NewTaskVoice />
      </div>
    </aside>
  );
}
