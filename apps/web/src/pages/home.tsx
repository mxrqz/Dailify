import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { useDailify } from "@/components/dailifyContext";
import { DayList } from "@/components/dashboard/day-list";
import { MonthCalendar } from "@/components/dashboard/month-calendar";
import { UndatedColumn, useUndatedOpen } from "@/components/dashboard/undated-column";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { CreateFab } from "@/components/dashboard/create-fab";
import { copy } from "@/components/dashboard/copy";
import { PageHeader } from "@/components/kit/page-header";
import { CALENDAR_VIEW } from "@/consts/conts";
import { ProgressRing } from "@/components/kit/progress-ring";
import { weekdayDate } from "@/functions/date-label";
import { fill, getCompletionDate, getTasksForDay } from "@/functions/functions";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { zoned } from "@/functions/zone";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";

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
            label={fill(copy.day.progress, { done, total })}
          />
        )
      }
    />
  );
}

/** O dashboard: a Hoje (título, semana, lista), o calendário do mês e, no desktop, a coluna lateral. */
export default function Home() {
  const { create, submitting } = useCreateTask();
  const { tasks, goToDay } = useDailify();
  const today = useNow("day");
  const todays = tasks ? getTasksForDay(tasks, today) : [];
  const done = todays.filter((task) => getCompletionDate(task, today) === true).length;

  const [undatedOpen, setUndatedOpen] = useUndatedOpen();
  const [createOn, setCreateOn] = useState<Date | null>(null);
  const [example, setExample] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const calendarOpen = params.get("view") === CALENDAR_VIEW;
  // A reminder notification opens `/dashboard?at=<epoch-ms>` (Android): land on that day, once.
  const at = Number(params.get("at"));
  const landOn = useEffectEvent((ms: number) => {
    void goToDay(zoned(ms));
    setParams(
      (prev) => {
        prev.delete("at");
        return prev;
      },
      { replace: true },
    );
  });
  useEffect(() => {
    if (Number.isFinite(at) && at > 0) landOn(at);
  }, [at]);
  // Entrou direto pelo link: não há o que voltar no histórico, então tira o parâmetro.
  const closeCalendar = () =>
    location.key === "default" ? setParams({}, { replace: true }) : navigate(-1);

  return (
    // Shell (md+): a agenda e a coluna lateral lado a lado.
    <div className="flex min-w-0 flex-1 md:p-1">
      <Helmet>
        <title>{copy.pageTitle.dashboard}</title>
      </Helmet>
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
            <DayList onTry={setExample} />
          </div>
        </div>

        {calendarOpen && <MonthCalendar onClose={closeCalendar} onCreateOn={setCreateOn} />}

        <CreateFab
          day={createOn}
          text={example}
          onDayDone={() => {
            setCreateOn(null);
            setExample(null);
          }}
          submitting={submitting}
          onSubmit={({ parsed, calendar }) => create(parsed, { calendar })}
        />
      </div>

      <UndatedColumn open={undatedOpen} onOpenChange={setUndatedOpen} />
    </div>
  );
}
