import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { startOfDay } from "date-fns";

import { useDailify } from "@/components/dailifyContext";
import { DayList } from "@/components/dashboard/day-list";
import { weekdayDate } from "@/components/dashboard/day-section";
import { MonthCalendar } from "@/components/dashboard/month-calendar";
import { UndatedColumn, useUndatedOpen } from "@/components/dashboard/undated-column";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { CreateFab } from "@/components/dashboard/create-fab";
import { copy } from "@/components/dashboard/copy";
import { PageHeader } from "@/components/kit/page-header";
import { ProgressRing } from "@/components/kit/progress-ring";
import { getCompletionDate, getTasksForDay } from "@/functions/functions";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";

/** `?view=calendar` abre o mês: o voltar do aparelho fecha. */
export const CALENDAR_VIEW = "calendar";

/** "Hoje", a data e o anel do placar (feitas/total das tarefas de hoje); sem tarefa, sem anel. */
export function TodayHeader({
  date,
  done,
  total,
}: {
  date: Date;
  done: number;
  total: number;
}): JSX.Element {
  return (
    <PageHeader
      title={copy.day.today}
      subtitle={weekdayDate(date, "EEEE, d 'de' MMMM")}
      className="px-1"
      trailing={
        total > 0 && (
          <ProgressRing
            value={done}
            max={total}
            className="mb-0.5"
            label={copy.day.progress
              .replace("{done}", String(done))
              .replace("{total}", String(total))}
          />
        )
      }
    />
  );
}

/** O dashboard: a Hoje (título, semana, lista), o calendário do mês e, no desktop, a coluna lateral. */
export default function Home() {
  const { create, submitting } = useCreateTask();
  const { tasks } = useDailify();
  const today = startOfDay(useNow(60_000));
  const todays = tasks ? getTasksForDay(tasks, today) : [];
  const done = todays.filter((task) => getCompletionDate(task, today) === true).length;

  const [undatedOpen, setUndatedOpen] = useUndatedOpen();
  const [createOn, setCreateOn] = useState<Date | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const calendarOpen = params.get("view") === CALENDAR_VIEW;
  // Entrou direto pelo link: não há o que voltar no histórico, então tira o parâmetro.
  const closeCalendar = () =>
    location.key === "default" ? setParams({}, { replace: true }) : navigate(-1);

  return (
    // Shell (md+): a agenda e a coluna lateral lado a lado.
    <div className="flex min-w-0 flex-1 md:p-1">
      <div className="relative min-w-0 flex-1 md:flex md:flex-col">
        {/* pb-30: a lista termina acima do dock do composer (~92px com a área segura). */}
        <div
          className={cn(
            "flex flex-col px-4 pb-30 md:px-gutter md:pt-6",
            calendarOpen && "md:hidden",
          )}
          id="main"
        >
          <TodayHeader date={today} done={done} total={todays.length} />

          <div className="pt-4">
            <WeekStrip />
          </div>

          <div className="mt-5">
            <DayList />
          </div>
        </div>

        {calendarOpen && <MonthCalendar onClose={closeCalendar} onCreateOn={setCreateOn} />}

        <CreateFab
          day={createOn}
          onDayDone={() => setCreateOn(null)}
          submitting={submitting}
          onSubmit={({ parsed, calendar }) => create(parsed, { calendar })}
        />
      </div>

      <UndatedColumn open={undatedOpen} onOpenChange={setUndatedOpen} />
    </div>
  );
}
