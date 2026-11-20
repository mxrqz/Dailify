import { useState } from "react";
import { VideoIcon } from "lucide-react";
import { videoLink, type ParsedTaskWire, type Task } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Chip } from "@/components/kit/chip";
import { CalendarBadge } from "@/components/logos";
import { Switch } from "@/components/kit/switch";
import { MewStatic } from "@/components/mew/mew-static";
import { Tip } from "@/components/tip";
import type { CalendarPick } from "@/hooks/useCalendarPush";
import { useCalendarDefault } from "@/hooks/useCalendarDefault";
import { useCalendarReady } from "@/hooks/useIntegrations";
import { useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";

const t = copy.calendar;

type Draft = Pick<Task, "undated" | "alert" | "links">;
/** `mew`: quem ligou foi a sugestão da Mew, não a pessoa — só muda a marca no chip. */
type Picked = CalendarPick & { mew?: boolean };

/**
 * A etiqueta Agenda do composer, por rascunho (`index`; a frase única é o 0). Nasce no padrão
 * das Configurações (Sempre/Nunca) e volta a ele a cada envio. O pedido explícito à Mew ("coloca no
 * Google Agenda") chega ligado mas ainda espera o Enter.
 */
export function useCalendarChip() {
  const ready = useCalendarReady();
  const online = useOnline();
  const [always] = useCalendarDefault();
  // `undefined` = ninguém mexeu (vale o padrão); `null` = desligada à mão.
  const [picks, setPicks] = useState<(Picked | null | undefined)[]>([]);

  // Precisa de dia: com data, ou Sem data com lembrete (vira evento de dia inteiro).
  const applies = (task: Draft) => ready && online && (!task.undated || task.alert !== undefined);
  const pick = (index: number): Picked | undefined =>
    picks[index] === undefined
      ? always
        ? { meet: false }
        : undefined
      : (picks[index] ?? undefined);
  const set = (index: number, next: Picked | undefined) =>
    setPicks((current) => Object.assign([...current], { [index]: next ?? null }));

  return {
    /** Conectado e online: a linha da etiqueta existe, mesmo antes de a frase ter dia. */
    available: ready && online,
    applies,
    pick,
    set,
    reset: () => setPicks([]),
    /** Os `targets` da Mew, por rascunho. Desconectado ou offline agora = ignorados. */
    suggest: (targets: ParsedTaskWire["targets"][]) =>
      setPicks(
        targets.map((list) => {
          const target = list?.find((x) => x.provider === "google-calendar");
          return target && ready && online ? { meet: Boolean(target.meet), mew: true } : undefined;
        }),
      ),
    /** O que vai pro Google no envio; `undefined` se a etiqueta está desligada ou não se aplica. */
    value: (index: number, task: Draft): CalendarPick | undefined => {
      const on = pick(index);
      return on && applies(task) ? { meet: on.meet && !videoLink(task.links) } : undefined;
    },
  };
}

/**
 * A linha da frase única, presentacional: "Agenda" + liga/desliga e, ligada, o "+ Meet".
 * `disabled`: ainda sem dia (a linha fica, pra não pular quando o dia aparece no texto).
 */
export function CalendarToggle({
  checked,
  disabled,
  mew,
  onCheckedChange,
  meet,
  onMeetChange,
}: {
  checked: boolean;
  disabled?: boolean;
  mew?: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** `undefined`: sem botão do Meet (desligada, ou já tem link de vídeo no texto). */
  meet?: boolean;
  onMeetChange: (meet: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <span className="flex items-center gap-2 text-subhead font-medium">
        <CalendarBadge className="size-5" />
        <span aria-hidden="true">{t.name}</span>
        {mew && <MewStatic className="size-4" />}
        <Tip content={mew ? t.mewPicked : undefined}>
          <Switch
            checked={checked}
            disabled={disabled}
            onCheckedChange={onCheckedChange}
            aria-label={t.chipLabel}
            className="ml-1"
          />
        </Tip>
      </span>
      {meet !== undefined && (
        <Chip
          pressed={meet}
          aria-label={t.meet}
          onClick={() => onMeetChange(!meet)}
          icon={<VideoIcon aria-hidden="true" className="size-4.5" />}
          className="ml-auto h-11"
        >
          {meet ? t.meetOn : t.meetChip}
        </Chip>
      )}
    </div>
  );
}

/** A etiqueta de um rascunho da Mew (vários de uma vez): chip pequeno de liga/desliga. */
export function CalendarChip({
  state,
  index,
  task,
}: {
  state: ReturnType<typeof useCalendarChip>;
  index: number;
  task: Draft;
}): JSX.Element | null {
  if (!state.applies(task)) return null;
  const pick = state.pick(index);

  return (
    <Tip content={pick?.mew ? t.mewPicked : undefined}>
      <Chip
        size="sm"
        pressed={Boolean(pick)}
        aria-label={t.chipLabel}
        onClick={() => state.set(index, pick ? undefined : { meet: false })}
        icon={<CalendarBadge className={cn(!pick && "grayscale")} />}
        className={cn(
          !pick && "bg-transparent text-ink-secondary ring-1 ring-separator ring-inset",
        )}
      >
        {t.name}
        {pick?.mew && <MewStatic className="size-3.5" />}
      </Chip>
    </Tip>
  );
}
