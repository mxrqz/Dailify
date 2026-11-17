import { useEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { ArrowDownIcon, PencilIcon } from "lucide-react";
import {
  addMonths,
  differenceInCalendarMonths,
  endOfMonth,
  startOfDay,
  startOfMonth,
} from "date-fns";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { DaySection, TaskSkeletons, dayAnchorId } from "@/components/dashboard/day-section";
import { Mew } from "@/components/mew/mew";
import { listDays, nextMonthToLoad } from "@/functions/functions";
import { useNow } from "@/hooks/useNow";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { zoned } from "@/functions/zone";

// Sem tarefa em tantos meses seguidos, a sentinela desiste de pedir o próximo.
const MAX_EMPTY_MONTHS = 12;

/** Primeiro uso: a Mew dormindo e o empurrão pro composer, que mora embaixo (o dock). */
export function FirstRun(): JSX.Element {
  return (
    <section
      aria-label={copy.day.listFirstRun}
      className="flex flex-col items-center px-4 py-16 text-center"
    >
      <Mew mood="sleepy" className="w-24" />
      <h2 className="mt-5 text-title-3 font-semibold">{copy.day.listFirstRun}</h2>
      <p className="mt-2 text-subhead text-balance text-ink-secondary">
        {copy.day.listFirstRunHint}
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <small className="text-footnote text-ink-secondary">{copy.day.listFirstRunTry}</small>
        {/* ponytail: só o exemplo, sem tocar pra preencher — o campo é do composer. */}
        <span className="card inline-flex h-11 items-center gap-2 rounded-sm px-4 text-subhead font-medium">
          <PencilIcon aria-hidden="true" className="size-4 text-ink-secondary" />
          {copy.day.listFirstRunExample}
        </span>
      </div>
      <ArrowDownIcon aria-hidden="true" className="mt-5 size-5 text-ink-secondary" />
    </section>
  );
}

/**
 * A lista do dashboard: um bloco por dia COM TAREFA (ou escolhido por clique), de hoje (ou do dia
 * passado escolhido) até o fim do trecho contíguo de meses carregados. A sentinela no fim pede o
 * mês seguinte com ~2 telas de folga, então ele já está lá quando a rolagem chega.
 */
export function DayList(): JSX.Element {
  const { selectedDay, tasks, undatedTasks, isLoading, loadedMonths, loadMonth, targetDay } =
    useDailify();
  const sentinel = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // `useNow` e não `new Date()` solto: com o app aberto na virada do dia, a lista continuava
  // começando em ontem.
  const today = useNow("day");
  const start = selectedDay < today ? startOfDay(selectedDay) : today;
  // Um mês longe de hoje pode estar carregado sozinho: a lista só vai até onde não há buraco.
  const nextMonth = nextMonthToLoad(loadedMonths, start);
  const nextKey = nextMonth.getTime();
  const booted = !!tasks;

  // Meses carregados desde a última tarefa: passou do limite, não há por que continuar pedindo.
  const lastTask = tasks?.reduce((max, t) => Math.max(max, t.date), 0);
  const emptyMonths =
    differenceInCalendarMonths(
      nextMonth,
      lastTask ? startOfMonth(zoned(lastTask)) : startOfMonth(today),
    ) - 1;
  const canLoadMore = emptyMonths < MAX_EMPTY_MONTHS;

  // Hoje entra também quando há tarefa sem data: o bloco "A qualquer hora" mora nele.
  const keepStart = start.getTime() === today.getTime() && !!undatedTasks?.length;
  const startKey = start.getTime();
  const days = useMemo(
    () =>
      listDays({
        start: zoned(startKey),
        end: endOfMonth(addMonths(zoned(nextKey), -1)),
        tasks: tasks ?? [],
        extra: targetDay ? [targetDay] : [],
        keepStart,
      }),
    [startKey, nextKey, tasks, targetDay, keepStart],
  );

  const loadMonthOf = useEffectEvent(loadMonth);
  // Reobserva a cada mês novo: o observer só avisa quando a interseção muda, e um mês sem tarefa
  // deixa a sentinela onde estava.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !booted || isLoading || !canLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMonthOf(zoned(nextKey));
      },
      { rootMargin: "0px 0px 200% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextKey, booted, isLoading, canLoadMore]);

  // Rola só quando o alvo muda, não quando o `reduce` muda.
  const scrollTo = useEffectEvent((day: Date) =>
    document
      .getElementById(dayAnchorId(day))
      ?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }),
  );
  // O alvo entrou na lista neste mesmo commit, então o elemento já existe quando o effect roda.
  useEffect(() => {
    if (targetDay) scrollTo(targetDay);
  }, [targetDay]);

  const sentinelEl = <div ref={sentinel} aria-hidden />;

  // Só no boot: na revalidação a lista fica, senão a rolagem e as âncoras se perdiam.
  if (isLoading && !tasks) return <TaskSkeletons />;

  // Primeiro uso e mês vazio são situações diferentes: uma pede um empurrão, a outra é só um fato.
  if (days.length === 0) {
    if (tasks?.length || undatedTasks?.length) {
      return (
        <>
          <p className="px-1 py-6 text-subhead text-ink-secondary">{copy.day.listEmpty}</p>
          {sentinelEl}
        </>
      );
    }

    return (
      <>
        <FirstRun />
        {sentinelEl}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {days.map((day) => (
        <DaySection key={day.toISOString()} day={day} />
      ))}
      {sentinelEl}
    </div>
  );
}
