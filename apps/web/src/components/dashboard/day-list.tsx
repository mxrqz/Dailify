import { eachDayOfInterval, endOfMonth, isSameMonth, startOfDay, startOfMonth } from "date-fns";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DaySection, TaskSkeletons } from "@/components/dashboard/day-section";
import { getTasksForDay } from "@/functions/functions";

/**
 * A lista do dashboard: um bloco por dia COM TAREFA, de hoje até o fim do mês carregado. Não há
 * mais troca entre "dia" e "mês" — é a mesma sequência, e quem rola é a página.
 *
 * Num mês que não é o atual (o mini-calendário navegou) começa no dia 1, porque não existe
 * "hoje" nele.
 */
export function DayList(): JSX.Element {
  const { selectedDay, tasks, isLoading } = useDailify();

  const today = startOfDay(new Date());
  const start = isSameMonth(selectedDay, today) ? today : startOfMonth(selectedDay);

  // Só os dias que têm tarefa: a sequência completa do mês era uma parede de "nenhuma tarefa".
  const days = eachDayOfInterval({ start, end: endOfMonth(selectedDay) }).filter(
    (day) => tasks && getTasksForDay(tasks, day).length > 0,
  );

  if (isLoading) return <TaskSkeletons />;

  if (days.length === 0) {
    return <p className="py-6 text-sm text-content-secondary">{copy.day.listEmpty}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {days.map((day) => (
        <DaySection key={day.toISOString()} day={day} />
      ))}
    </div>
  );
}
