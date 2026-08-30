import { eachDayOfInterval, endOfMonth, isSameMonth, startOfDay, startOfMonth } from "date-fns";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DaySection, TaskSkeletons } from "@/components/dashboard/day-section";
import { getTasksForDay } from "@/functions/functions";
import { useNow } from "@/hooks/useNow";

/**
 * A lista do dashboard: um bloco por dia COM TAREFA, de hoje até o fim do mês carregado. Não há
 * mais troca entre "dia" e "mês" — é a mesma sequência, e quem rola é a página.
 *
 * Num mês que não é o atual (o mini-calendário navegou) começa no dia 1, porque não existe
 * "hoje" nele.
 */
export function DayList(): JSX.Element {
  const { selectedDay, tasks, isLoading } = useDailify();

  // `useNow` e não `new Date()` solto: com o app aberto na virada do dia, a lista continuava
  // começando em ontem.
  const today = startOfDay(useNow(60_000));
  const start = isSameMonth(selectedDay, today) ? today : startOfMonth(selectedDay);

  // Só os dias que têm tarefa: a sequência completa do mês era uma parede de "nenhuma tarefa".
  const days = eachDayOfInterval({ start, end: endOfMonth(selectedDay) }).filter(
    (day) => tasks && getTasksForDay(tasks, day).length > 0,
  );

  if (isLoading) return <TaskSkeletons />;

  // Primeiro uso e mês vazio são situações diferentes: uma pede um empurrão, a outra é só um fato.
  if (days.length === 0) {
    if (tasks?.length) {
      return <p className="py-6 text-sm text-content-secondary">{copy.day.listEmpty}</p>;
    }

    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-surface-line px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">{copy.day.listFirstRun}</p>
        <p className="max-w-xs text-sm text-content-secondary">{copy.day.listFirstRunHint}</p>
        <p className="mt-1 rounded-md bg-surface-panel px-2 py-1 font-mono text-2xs text-muted-foreground">
          {copy.day.listFirstRunExample}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {days.map((day) => (
        <DaySection key={day.toISOString()} day={day} />
      ))}
    </div>
  );
}
