import { eachDayOfInterval, endOfMonth, isSameMonth, startOfDay, startOfMonth } from "date-fns";

import { useDailify } from "@/components/dailifyContext";
import { DaySection, TaskSkeletons } from "@/components/dashboard/day-section";

/**
 * A lista do dashboard: um bloco por dia, de hoje até o fim do mês carregado. Não há mais troca
 * entre "dia" e "mês" — é a mesma sequência, e quem rola é a página.
 *
 * Num mês que não é o atual (o mini-calendário navegou) começa no dia 1, porque não existe
 * "hoje" nele.
 */
export function DayList(): JSX.Element {
  const { selectedDay, isLoading } = useDailify();

  const today = startOfDay(new Date());
  const start = isSameMonth(selectedDay, today) ? today : startOfMonth(selectedDay);
  const days = eachDayOfInterval({ start, end: endOfMonth(selectedDay) });

  if (isLoading) return <TaskSkeletons />;

  return (
    <div className="flex flex-col gap-8">
      {days.map((day) => (
        <DaySection key={day.toISOString()} day={day} />
      ))}
    </div>
  );
}
