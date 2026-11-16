import { useState } from "react";
import { CalendarCheckIcon, CalendarPlusIcon, VideoIcon } from "lucide-react";
import { videoLink, type Task } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { chip, chipGhost } from "@/components/dashboard/styles";
import type { CalendarPick } from "@/hooks/useCalendarPush";
import { useCalendarReady } from "@/hooks/useIntegrations";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

const t = copy.calendar;
const chipOn = "border-accent-line bg-accent-subtle text-brand-text";

type Draft = Pick<Task, "undated" | "alert" | "links">;

/**
 * A etiqueta Google Agenda do composer, por rascunho (`index`; a frase única é o 0). Desligada por
 * padrão e esquecida a cada envio: ligar é a confirmação, então nunca vem ligada sozinha.
 */
export function useCalendarChip() {
  const ready = useCalendarReady();
  const online = useOnline();
  const [picks, setPicks] = useState<(CalendarPick | undefined)[]>([]);

  // Precisa de dia: com data, ou Sem data com lembrete (vira evento de dia inteiro).
  const applies = (task: Draft) => ready && online && (!task.undated || task.alert !== undefined);
  const set = (index: number, pick: CalendarPick | undefined) =>
    setPicks((current) => Object.assign([...current], { [index]: pick }));

  return {
    applies,
    picks,
    set,
    reset: () => setPicks([]),
    /** O que vai pro Google no envio; `undefined` se a etiqueta está desligada ou não se aplica. */
    value: (index: number, task: Draft): CalendarPick | undefined => {
      const pick = picks[index];
      return pick && applies(task) ? { meet: pick.meet && !videoLink(task.links) } : undefined;
    },
  };
}

export function CalendarChip({
  state,
  index,
  task,
  large,
}: {
  state: ReturnType<typeof useCalendarChip>;
  index: number;
  task: Draft;
  large?: boolean;
}): JSX.Element | null {
  if (!state.applies(task)) return null;
  const pick = state.picks[index];
  const size = large ? "py-1.5" : "py-0.5";
  const Icon = pick ? CalendarCheckIcon : CalendarPlusIcon;

  return (
    <>
      <button
        type="button"
        aria-pressed={Boolean(pick)}
        aria-label={t.chipLabel}
        onClick={() => state.set(index, pick ? undefined : { meet: false })}
        className={cn(chip, size, "shrink-0 transition-colors", pick ? chipOn : chipGhost)}
      >
        <Icon className="size-3" aria-hidden="true" />
        {t.chip}
      </button>
      {pick && !videoLink(task.links) && (
        <button
          type="button"
          aria-pressed={pick.meet}
          aria-label={t.meet}
          onClick={() => state.set(index, { meet: !pick.meet })}
          className={cn(chip, size, "shrink-0 transition-colors", pick.meet ? chipOn : chipGhost)}
        >
          <VideoIcon className="size-3" aria-hidden="true" />
          {t.meetChip}
        </button>
      )}
    </>
  );
}
