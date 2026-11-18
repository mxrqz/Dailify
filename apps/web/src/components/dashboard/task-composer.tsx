import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BellIcon, CalendarIcon, ClockIcon, LinkIcon, Loader2Icon, RepeatIcon } from "lucide-react";
import {
  DEFAULT_DURATION,
  DEFAULT_HOUR,
  TASK_LIMITS,
  composeTaskInput,
  fromWire,
  parseTaskText,
  remapSpans,
  type Field,
  type ParsedTask,
  type Span,
  videoLink,
} from "@dailify/shared";

import {
  CalendarChip,
  CalendarToggle,
  useCalendarChip,
} from "@/components/dashboard/calendar-chip";
import {
  ChipStrip,
  ComposerActions,
  ComposerField,
  ComposerHeader,
  DraftMeta,
  HeaderButton,
  MetaChip,
  MewBubble,
  MewCard,
  MewCredits,
  MewDrafts,
  MicButton,
  VoiceSheet,
} from "@/components/dashboard/composer-views";
import { copy } from "@/components/dashboard/copy";
import { copy as kitCopy } from "@/components/kit/copy";
import { MewStatic } from "@/components/mew/mew-static";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { markSegments, onDay, withEdits, type Edits } from "@/functions/compose-input";
import type { CalendarPick } from "@/hooks/useCalendarPush";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useEffectEvent } from "@/hooks/useEffectEvent";
import { useMewParse } from "@/hooks/useMewParse";
import { useOnline } from "@/hooks/useOnline";
import { MAX_RECORDING_MS, useVoiceCreate, voiceSupported } from "@/hooks/useVoiceCreate";
import { repeatLabel } from "@/functions/repeat-label";
import { linkLabel } from "@/functions/link-label";
import {
  DateTimePopover,
  DayPopover,
  DurationMenu,
  LinksPopover,
  RepeatMenu,
} from "@/components/dashboard/task-meta-menus";
import { useDailify } from "@/components/dailifyContext";
import { clockAt, dayDot } from "@/functions/date-label";
import { fill } from "@/functions/functions";
import { remainingLabel } from "@/functions/quota-label";
import { appTimeZone, zoned } from "@/functions/zone";

export interface ComposerValues {
  parsed: ParsedTask;
  /** A frase como foi digitada, pra devolver ao campo se a criação falhar. */
  text: string;
  /** A etiqueta Google Agenda ligada: depois de criada, a tarefa vai pra lá. */
  calendar?: CalendarPick;
}

interface TaskComposerProps {
  submitting?: boolean;
  /**
   * `again`: ⇧⏎, criar e continuar — quem abriu a folha a mantém aberta. O campo limpa na hora
   * (a tarefa já entrou otimista); `false` devolve o texto, se o campo ainda estiver vazio.
   */
  onSubmit: (values: ComposerValues, again: boolean) => Promise<boolean>;
  /** Folha do mobile: topo Cancelar | Nova tarefa, texto grande, chips flutuando acima. */
  large?: boolean;
  /** Texto que volta ao campo quando a folha reabre depois de uma criação recusada. */
  initialText?: string;
  /** Dia escolhido no calendário: vale quando a frase não cita um dia. */
  day?: Date | null;
  /** A voz ou a Mew criaram tarefas (direto no servidor): quem abriu a folha pode fechá-la. */
  onCreated?: () => void;
  /** O "Cancelar" do topo da folha. */
  onCancel?: () => void;
  /** Montou pelo mic do dock: já começa gravando. */
  listen?: boolean;
}

/** O campo da frase; `create-fab` o foca pelo id (atalhos `n` e `/`, dia escolhido no calendário). */
export const COMPOSER_TEXT_ID = "composer-text";

/**
 * A frase da folha de criação. O que o parser tirou dela aparece em chips logo acima (ou abaixo, no
 * desktop) — sem esse eco o usuário só descobre no envio que a hora não foi entendida.
 */
export function TaskComposer({
  submitting,
  onSubmit,
  large,
  initialText = "",
  day,
  onCreated,
  onCancel,
  listen,
}: TaskComposerProps): JSX.Element {
  const [input, setInput] = useState(initialText);
  // Trechos de chips tirados: voltam pro título como texto. Valem pro texto atual (`remapSpans`).
  const [ignore, setIgnore] = useState<Span[]>([]);
  const [edits, setEdits] = useState<Edits>({});
  const textRef = useRef<HTMLTextAreaElement>(null);
  const { hour12 } = useDailify();
  const online = useOnline();
  const mew = useMewParse();
  const many = useCreateTask();
  const calendar = useCalendarChip();

  const local = useMemo(
    () => onDay(parseTaskText(input, zoned(), { ignore }), day),
    [input, day, ignore],
  );
  // A leitura da Mew vale pro texto que ela leu: editar chama `mew.reset` e volta pro parser local.
  const drafts = useMemo(
    () =>
      mew.result?.intent === "create"
        ? mew.result.drafts.map((draft) => fromWire(draft, appTimeZone()))
        : [],
    [mew.result],
  );
  const draftTasks = useMemo(() => drafts.map((d) => composeTaskInput(d, zoned())), [drafts]);
  const reply = mew.result && !drafts.length ? mew.result.reply : null;
  const multi = drafts.length > 1;
  const read = useMemo(
    () => (drafts.length === 1 ? onDay(drafts[0], day) : local),
    [drafts, local, day],
  );
  // Rascunho da Mew não tem trechos no texto: sem marcas.
  const marks = useMemo(
    () => (drafts.length ? [] : markSegments(input, local, ignore)),
    [drafts, input, local, ignore],
  );
  const parsed = useMemo(() => withEdits(read, edits, zoned()), [read, edits]);
  const task = useMemo(() => composeTaskInput(parsed, zoned()), [parsed]);
  const voice = useVoiceCreate(onCreated);
  const canVoice = online && voiceSupported();
  const busy = submitting || many.submitting || mew.pending || voice.state !== "idle";
  const canSubmit = Boolean(parsed.text) && !busy;
  const canAsk = Boolean(input.trim()) && !mew.result && !busy;
  const unsure = online && local.unsure.length > 0 && Boolean(input.trim()) && !mew.result;

  const startListening = useEffectEvent(() => {
    if (canVoice) void voice.start();
  });
  useEffect(() => {
    if (listen) startListening();
  }, [listen]);

  const destination = !task.undated
    ? copy.composer.toAgenda
    : task.repeat !== "Off"
      ? copy.composer.toRecurring
      : copy.composer.toUndated;

  const recurring = parsed.repeat !== "Off";

  const clear = () => {
    setInput("");
    setIgnore([]);
    setEdits({});
    mew.reset();
    calendar.reset();
  };

  const focusText = () => textRef.current?.focus();
  const edit = (next: Edits) => setEdits((current) => ({ ...current, ...next }));
  // As palavras que deram o campo voltam pro título; sem palavras (Mew, calendário), o campo só zera.
  const remove = (field: Field) => {
    const spans = read.fields[field];
    if (spans.length) setIgnore((current) => [...current, ...spans]);
    setEdits((current) => {
      const next = { ...current };
      if (spans.length) delete next[field];
      else next[field] = null;
      return next;
    });
    focusText();
  };

  const dayLabel = parsed.date && dayDot(parsed.date);
  const timeLabel = parsed.hasTime && parsed.date ? clockAt(parsed.date, hour12) : null;
  const wheelAt = zoned(parsed.date ?? undefined);
  if (!timeLabel) wheelAt.setHours(DEFAULT_HOUR, 0, 0, 0);
  const alertLabel = (alert: number) =>
    fill(copy.composer.alertAt, {
      day: format(zoned(alert), "EEEEEE", { locale: ptBR }),
      time: clockAt(alert, hour12),
    });

  const submit = (again: boolean) => {
    if (!canSubmit) return;
    if (multi) {
      const picks = draftTasks.map((draft, i) => calendar.value(i, draft));
      void many.createMany(drafts, picks).then((ok) => {
        if (!ok) return;
        clear();
        onCreated?.();
      });
      return;
    }
    const text = input;
    void onSubmit({ parsed, text, calendar: calendar.value(0, task) }, again).then((ok) => {
      if (!ok) setInput((current) => current || text);
    });
    clear();
  };

  // O botão fica desativado durante a leitura e o foco cairia no body: volta pro campo, pro Enter.
  const askMew = () => {
    calendar.reset();
    void mew.ask(input).then((read) => {
      if (read?.intent === "create") calendar.suggest(read.drafts.map((d) => d.targets));
      focusText();
    });
  };

  const remaining = mew.remaining === null ? null : remainingLabel(mew.remaining);

  if (voice.state !== "idle")
    return (
      <VoiceSheet
        sending={voice.state === "sending"}
        analyser={voice.analyser}
        maxMs={MAX_RECORDING_MS}
        onCancel={voice.cancel}
        onStop={voice.stop}
      />
    );

  const primary = (
    <Button
      type="submit"
      size={large ? "lg" : "default"}
      aria-label={multi ? undefined : copy.composer.submit}
      disabled={!canSubmit}
    >
      {(submitting || many.submitting) && <Loader2Icon className="animate-spin" />}
      {multi ? fill(copy.mew.confirmMany, { n: drafts.length }) : copy.composer.submit}
    </Button>
  );

  const form = (children: JSX.Element) => (
    <form
      className="flex flex-col"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit(false);
      }}
    >
      {children}
    </form>
  );

  // Vários rascunhos: confirma no balão da Mew antes de criar (o texto volta com "Voltar").
  if (multi)
    return form(
      <>
        <ComposerHeader
          start={
            <HeaderButton
              onClick={() => {
                mew.reset();
                calendar.reset();
              }}
            >
              {copy.header.back}
            </HeaderButton>
          }
        />
        <p className="mt-2 text-body text-ink-secondary">{input}</p>
        <MewDrafts
          say={mew.result?.reply || fill(copy.mew.found, { n: drafts.length })}
          drafts={drafts.map((draft, i) => {
            const t = draftTasks[i];
            const time = draft.hasTime && draft.date ? clockAt(draft.date, hour12) : null;
            return {
              title: draft.text,
              meta: (
                <>
                  <DraftMeta icon={<CalendarIcon aria-hidden="true" />}>
                    {draft.date ? dayDot(draft.date) : copy.composer.toUndated}
                    {time && (
                      <>
                        <ClockIcon aria-hidden="true" className="ml-1" />
                        {[time, draft.duration].filter(Boolean).join(" · ")}
                      </>
                    )}
                  </DraftMeta>
                  {draft.repeat !== "Off" && (
                    <DraftMeta icon={<RepeatIcon aria-hidden="true" />}>
                      {repeatLabel(draft.repeat, draft.repeatEvery)}
                    </DraftMeta>
                  )}
                  {t.alert !== undefined && (
                    <DraftMeta icon={<BellIcon aria-hidden="true" />}>
                      {fill(copy.composer.reminderAt, { value: alertLabel(t.alert) })}
                    </DraftMeta>
                  )}
                </>
              ),
              calendar: <CalendarChip state={calendar} index={i} task={t} />,
            };
          })}
        />
        <MewCredits credits={remaining && fill(copy.mew.credits, { left: remaining })} />
        <ComposerActions large>
          <Button
            variant="secondary"
            size={large ? "lg" : "default"}
            onClick={() => {
              clear();
              onCancel?.();
            }}
          >
            {kitCopy.cancel}
          </Button>
          {primary}
        </ComposerActions>
      </>,
    );

  const meet = calendar.pick(0);
  const size = { large };

  return form(
    <>
      {large && (
        <ComposerHeader
          start={onCancel && <HeaderButton onClick={onCancel}>{kitCopy.cancel}</HeaderButton>}
        />
      )}
      <Label htmlFor={COMPOSER_TEXT_ID} className="sr-only">
        {copy.composer.text}
      </Label>
      <ComposerField
        ref={textRef}
        id={COMPOSER_TEXT_ID}
        large={large}
        marks={marks}
        value={input}
        onChange={(e) => {
          const next = e.target.value;
          setIgnore((current) => remapSpans(current, input, next));
          setInput(next);
          // Os rascunhos da Mew somem com a edição, e as etiquetas deles junto.
          if (mew.result) calendar.reset();
          mew.reset();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
          e.preventDefault();
          submit(e.shiftKey);
        }}
        maxLength={TASK_LIMITS.titleMax}
        readOnly={mew.pending}
        placeholder={copy.composer.textPlaceholder}
      />

      {/* Slots sempre montados, na mesma ordem: chip que some e aparece mexe a faixa a cada tecla. */}
      <ChipStrip large={large}>
        {drafts.length === 1 && <MewStatic className="size-5 flex-none" title={copy.mew.draft} />}
        {recurring ? (
          <MetaChip
            {...size}
            icon={<RepeatIcon aria-hidden="true" className="text-meta-repeat" />}
            editLabel={fill(copy.composer.editRepeat, {
              value: repeatLabel(parsed.repeat, parsed.repeatEvery),
            })}
            removeLabel={copy.composer.removeRepeat}
            onRemove={() => remove("repeat")}
            editor={(trigger) => (
              <RepeatMenu
                value={parsed.repeat}
                every={parsed.repeatEvery}
                date={(parsed.date ?? zoned()).getTime()}
                onChange={(repeat, repeatEvery) => edit({ repeat, repeatEvery })}
              >
                {trigger}
              </RepeatMenu>
            )}
          >
            {repeatLabel(parsed.repeat, parsed.repeatEvery)}
          </MetaChip>
        ) : (
          <MetaChip
            {...size}
            ghost={!dayLabel}
            icon={dayLabel && <CalendarIcon aria-hidden="true" className="text-meta-date" />}
            editLabel={dayLabel ? fill(copy.composer.editDay, { value: dayLabel }) : undefined}
            removeLabel={copy.composer.removeDay}
            onRemove={dayLabel && parsed.hasDay ? () => remove("day") : undefined}
            editor={(trigger) => (
              <DayPopover value={parsed.date ?? zoned()} onChange={(day) => edit({ day })}>
                {trigger}
              </DayPopover>
            )}
          >
            {dayLabel || copy.composer.addDay}
          </MetaChip>
        )}
        <MetaChip
          {...size}
          ghost={!timeLabel}
          icon={timeLabel && <ClockIcon aria-hidden="true" className="text-meta-time" />}
          editLabel={timeLabel ? fill(copy.composer.editTime, { value: timeLabel }) : undefined}
          removeLabel={copy.composer.removeTime}
          onRemove={timeLabel ? () => remove("time") : undefined}
          editor={(trigger) => (
            <DateTimePopover
              timeOnly
              value={wheelAt}
              onChange={(at) => edit({ time: { hour: at.getHours(), minute: at.getMinutes() } })}
            >
              {trigger}
            </DateTimePopover>
          )}
        >
          {timeLabel ?? copy.composer.addTime}
        </MetaChip>
        <MetaChip
          {...size}
          ghost={!parsed.duration}
          editLabel={
            parsed.duration
              ? fill(copy.composer.editDuration, { value: parsed.duration })
              : undefined
          }
          removeLabel={copy.composer.removeDuration}
          onRemove={parsed.duration ? () => remove("duration") : undefined}
          editor={(trigger) => (
            <DurationMenu
              value={parsed.duration ?? DEFAULT_DURATION}
              onChange={(next) => edit({ duration: next })}
            >
              {trigger}
            </DurationMenu>
          )}
        >
          {parsed.duration ?? copy.composer.addDuration}
        </MetaChip>
        <MetaChip
          {...size}
          ghost={task.alert === undefined}
          icon={task.alert !== undefined && <BellIcon aria-hidden="true" />}
        >
          {task.alert !== undefined ? alertLabel(task.alert) : copy.composer.addReminder}
        </MetaChip>
        {parsed.links.slice(0, 1).map((url) => (
          <MetaChip
            key={url}
            {...size}
            icon={<LinkIcon aria-hidden="true" />}
            editLabel={fill(copy.composer.editLinks, { value: linkLabel(url) })}
            removeLabel={copy.composer.removeLinks}
            onRemove={() => remove("links")}
            editor={(trigger) => (
              <LinksPopover value={parsed.links} onChange={(links) => edit({ links })}>
                {trigger}
              </LinksPopover>
            )}
          >
            {linkLabel(url)}
          </MetaChip>
        ))}
      </ChipStrip>

      {reply && (
        <MewBubble role="status">
          <p className="pr-3 pb-2 text-body">{reply}</p>
        </MewBubble>
      )}

      {calendar.available && (
        <div className="mt-5">
          <CalendarToggle
            checked={Boolean(meet)}
            disabled={!calendar.applies(task)}
            mew={meet?.mew}
            onCheckedChange={(on) => calendar.set(0, on ? { meet: false } : undefined)}
            meet={meet && !videoLink(task.links) ? meet.meet : undefined}
            onMeetChange={(on) => meet && calendar.set(0, { ...meet, meet: on })}
          />
        </div>
      )}

      {/* O parser erra ~20% dos casos difíceis sem avisar: o pedido à Mew fica sempre à mão. */}
      {online && (
        <MewCard
          pending={mew.pending}
          disabled={mew.exhausted || !canAsk}
          exhausted={mew.exhausted}
          hints={[unsure ? copy.mew.unsure[local.unsure[0].code] : null, remaining].filter(
            (hint): hint is string => Boolean(hint),
          )}
          onClick={askMew}
        />
      )}

      <ComposerActions
        large={large}
        start={
          large ? (
            canVoice && <MicButton large onClick={() => void voice.start()} />
          ) : (
            <span className="mr-auto text-footnote text-ink-secondary">
              {copy.composer.goesTo} <b className="font-medium text-ink">{destination}</b>
              <span className="ml-2.5 hidden md:inline">
                {copy.composer.hintCreate}{" "}
                <kbd className="rounded-xs border border-separator px-1 font-mono text-2xs">⇧⏎</kbd>{" "}
                {copy.composer.hintContinue}
              </span>
            </span>
          )
        }
      >
        {!large && canVoice && <MicButton onClick={() => void voice.start()} />}
        {primary}
      </ComposerActions>
    </>,
  );
}
