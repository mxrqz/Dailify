import { useEffect, useState } from "react";
import { PanelRightIcon, PlusIcon } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";

import { Toolbar } from "@/components/app-header";
import { useDailify } from "@/components/dailifyContext";
import { DayList } from "@/components/dashboard/day-list";
import { MonthCalendar } from "@/components/dashboard/month-calendar";
import { PanelHost, SIDE_PANEL_ID } from "@/components/dashboard/side-panel";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { CreateFab } from "@/components/dashboard/create-fab";
import { copy } from "@/components/dashboard/copy";
import { PageHeader } from "@/components/kit/page-header";
import { Onboarding } from "@/components/onboarding/onboarding";
import { Tip } from "@/components/tip";
import { Button } from "@/components/ui/button";
import { DESKTOP } from "@/consts/media";
import { ProgressRing } from "@/components/kit/progress-ring";
import { weekdayDate } from "@/functions/date-label";
import { fill, getCompletionDate, getTasksForDay } from "@/functions/functions";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useCalendarView } from "@/hooks/useCalendarView";
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
  const { open: calendarOpen, close: closeCalendar } = useCalendarView();
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
  // The Android assist gesture, shortcut and tile open `/dashboard?mew=voice`: the Mew listening.
  const [voiceSignal, setVoiceSignal] = useState(0);
  const mewVoice = params.get("mew") === "voice";
  const startVoice = useEffectEvent(() => {
    setVoiceSignal((n) => n + 1);
    setParams(
      (prev) => {
        prev.delete("mew");
        return prev;
      },
      { replace: true },
    );
  });
  useEffect(() => {
    if (mewVoice) startVoice();
  }, [mewVoice]);

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
            calendarOpen && desktop && "hidden",
          )}
          id="main"
        >
          <TodayHeader date={today} done={done} total={todays.length} />

          <WeekStrip expanded={calendarOpen && !desktop} onCollapse={closeCalendar} />

          <div className="mt-3">
            <DayList onTry={setExample} />
          </div>
        </div>

        {calendarOpen && desktop && <MonthCalendar />}

        <CreateFab
          day={createOn}
          text={example}
          onDayDone={() => {
            setCreateOn(null);
            setExample(null);
          }}
          submitting={submitting}
          onSubmit={({ parsed, calendar, before }) => create(parsed, { calendar, before })}
          openSignal={createSignal}
          voiceSignal={voiceSignal}
        />
        {/* A reminder tap or the assistant gesture goes straight to its intent; the intro waits. */}
        <Onboarding onTry={setExample} hold={mewVoice || (Number.isFinite(at) && at > 0)} />
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
