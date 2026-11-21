import { useEffect, useState } from "react";
import { PanelRightIcon, PlusIcon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { Toolbar } from "@/components/app-header";
import { useDailify } from "@/components/dailifyContext";
import { DayList } from "@/components/dashboard/day-list";
import { MonthCalendar } from "@/components/dashboard/month-calendar";
import { PanelHost, SIDE_PANEL_ID } from "@/components/dashboard/side-panel";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { CreateFab } from "@/components/dashboard/create-fab";
import { copy } from "@/components/dashboard/copy";
import { PageHeader } from "@/components/kit/page-header";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { CALENDAR_VIEW } from "@/consts/conts";
import { DESKTOP } from "@/consts/media";
import { ProgressRing } from "@/components/kit/progress-ring";
import { weekdayDate } from "@/functions/date-label";
import { fill, getCompletionDate, getTasksForDay } from "@/functions/functions";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { closePanel, togglePanel, usePanel } from "@/hooks/usePanel";
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

/** O dashboard: a Hoje (título, semana, lista), o calendário do mês e, no desktop, o painel lateral. */
export default function Home() {
  const { create, submitting } = useCreateTask();
  const { tasks, goToDay } = useDailify();
  const today = useNow("day");
  const todays = tasks ? getTasksForDay(tasks, today) : [];
  const done = todays.filter((task) => getCompletionDate(task, today) === true).length;

  const desktop = useMediaQuery(DESKTOP);
  const panelOpen = usePanel() !== null;
  const [createSignal, setCreateSignal] = useState(0);
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
    // Shell (md+): the agenda column and, when open, the side panel beside it.
    <div className="flex min-w-0 flex-1">
      <Helmet>
        <title>{copy.pageTitle.dashboard}</title>
      </Helmet>
      <div className="relative min-w-0 flex-1 md:flex md:flex-col">
        <Toolbar>
          <Button
            variant="secondary"
            size="sm"
            aria-keyshortcuts="n"
            onClick={() => setCreateSignal((n) => n + 1)}
          >
            <PlusIcon aria-hidden="true" />
            {copy.composer.open}
            <kbd
              aria-hidden="true"
              className="grid h-5 min-w-5 place-items-center rounded-xs bg-fill-pressed px-1 text-xs font-medium text-ink-secondary"
            >
              N
            </kbd>
          </Button>
          <Tip content={panelOpen ? copy.panel.close : copy.panel.open}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={panelOpen ? copy.panel.close : copy.panel.open}
              aria-expanded={panelOpen}
              aria-controls={SIDE_PANEL_ID}
              onClick={togglePanel}
              className="aria-expanded:bg-fill"
            >
              <PanelRightIcon aria-hidden="true" />
            </Button>
          </Tip>
        </Toolbar>

        {/* pb-30: a lista termina acima do dock do composer (~92px com a área segura); no desktop o dock está no fluxo. */}
        <div
          className={cn(
            "flex flex-col px-4 pb-30 md:mx-auto md:pb-6 md:w-full md:max-w-180 md:px-8 md:pt-1",
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
          openSignal={createSignal}
        />
      </div>

      {desktop && (
        <PanelHost
          onCreateOn={setCreateOn}
          onOpenDay={(day) => {
            void goToDay(day);
            if (calendarOpen) closeCalendar();
            closePanel();
          }}
        />
      )}
    </div>
  );
}
