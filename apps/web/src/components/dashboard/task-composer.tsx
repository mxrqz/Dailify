import { FormEvent, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowUpIcon,
  BellIcon,
  CalendarIcon,
  ClockIcon,
  LinkIcon,
  Loader2Icon,
  MicIcon,
  RepeatIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { motion } from "motion/react";

import { TASK_LIMITS } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { MewStatic } from "@/components/mew/mew-static";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_DURATION,
  DEFAULT_HOUR,
  composeTaskInput,
  fromWire,
  onDay,
  withEdits,
  type Edits,
} from "@/functions/compose-input";
import {
  parseTaskText,
  remapSpans,
  type Field,
  type ParsedTask,
  type Span,
} from "@/functions/parse-task";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useMewParse } from "@/hooks/useMewParse";
import { useOnline } from "@/hooks/useOnline";
import { useVoiceCreate, voiceSupported } from "@/hooks/useVoiceCreate";
import { repeatLabel } from "@/functions/repeat-label";
import { linkLabel } from "@/functions/link-label";
import {
  chip,
  chipDate,
  chipGhost,
  chipGot,
  chipRepeat,
  chipTime,
} from "@/components/dashboard/styles";
import {
  DateTimePopover,
  DayPopover,
  DurationMenu,
  LinksPopover,
  RepeatMenu,
} from "@/components/dashboard/task-meta-menus";
import { useDailify } from "@/components/dailifyContext";
import { duration, ease } from "@/consts/motion";
import { formatClock } from "@/functions/functions";
import { cn } from "@/lib/utils";
import { zoned } from "@/functions/zone";

/**
 * Um chip do composer: tocar abre o editor do campo; o × (ou Backspace no chip) tira o campo.
 * Sem `onRemove` é o fantasma ("+ dia"), que só edita.
 */
function Chip({
  tone,
  large,
  editLabel,
  removeLabel,
  onRemove,
  editor,
  children,
}: {
  tone: string;
  large?: boolean;
  editLabel?: string;
  removeLabel: string;
  onRemove?: () => void;
  editor: (trigger: JSX.Element) => JSX.Element;
  children: ReactNode;
}): JSX.Element {
  return (
    <span className={cn(chip, tone, "gap-0 p-0")}>
      {editor(
        <button
          type="button"
          aria-label={editLabel}
          onKeyDown={(e) => {
            if (!onRemove || (e.key !== "Backspace" && e.key !== "Delete")) return;
            e.preventDefault();
            onRemove();
          }}
          className={cn("rounded-lg px-2", large ? "py-1.5" : "py-0.5", onRemove && "pr-1")}
        >
          <motion.span
            key={String(Boolean(onRemove))}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className="inline-flex items-center gap-1"
          >
            {children}
          </motion.span>
        </button>,
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel}
          onClick={onRemove}
          className="flex items-center rounded-full pr-1.5 pl-0.5 transition-colors hover:text-foreground"
        >
          <XIcon className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

export interface ComposerValues {
  parsed: ParsedTask;
}

interface TaskComposerProps {
  submitting?: boolean;
  /** `again`: ⇧⏎, criar e continuar — quem abriu a folha a mantém aberta. */
  onSubmit: (values: ComposerValues, again: boolean) => void;
  /** Folha do mobile: título grande sem moldura, chips maiores e o enviar na linha deles. */
  large?: boolean;
  /** Dia escolhido no calendário: vale quando a frase não cita um dia. */
  day?: Date | null;
  /** A voz ou a Mew criaram tarefas (direto no servidor): quem abriu a folha pode fechá-la. */
  onCreated?: () => void;
}

/**
 * A frase da folha de criação. O que o parser tirou dela aparece em chips logo abaixo, e a linha
 * "Vai para" diz onde a tarefa cai — sem esse eco o usuário só descobre no envio que a hora não
 * foi entendida.
 */
export function TaskComposer({
  submitting,
  onSubmit,
  large,
  day,
  onCreated,
}: TaskComposerProps): JSX.Element {
  const [input, setInput] = useState("");
  // Trechos de chips tirados: voltam pro título como texto. Valem pro texto atual (`remapSpans`).
  const [ignore, setIgnore] = useState<Span[]>([]);
  const [edits, setEdits] = useState<Edits>({});
  const { hour12 } = useDailify();
  const online = useOnline();
  const mew = useMewParse();
  const many = useCreateTask();

  const local = useMemo(
    () => onDay(parseTaskText(input, zoned(), { ignore }), day),
    [input, day, ignore],
  );
  // A leitura da Mew vale pro texto que ela leu: editar chama `mew.reset` e volta pro parser local.
  const drafts = useMemo(
    () => (mew.result?.intent === "create" ? mew.result.drafts.map(fromWire) : []),
    [mew.result],
  );
  const reply = mew.result && !drafts.length ? mew.result.reply : null;
  const multi = drafts.length > 1;
  const read = useMemo(
    () => (drafts.length === 1 ? onDay(drafts[0], day) : local),
    [drafts, local, day],
  );
  const parsed = useMemo(() => withEdits(read, edits, zoned()), [read, edits]);
  const task = useMemo(() => composeTaskInput(parsed, zoned()), [parsed]);
  const voice = useVoiceCreate(onCreated);
  const listening = voice.state === "recording";
  const busy = submitting || many.submitting || mew.pending || voice.state !== "idle";
  const canSubmit = Boolean(parsed.text) && !busy;
  const canAsk = Boolean(input.trim()) && !mew.result && !busy;
  const prominent = online && local.unsure.length > 0 && Boolean(input.trim()) && !mew.result;

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
  };

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
    document.getElementById("composer-text")?.focus();
  };

  // EEEEEE, não EEE: no locale pt-BR o `EEE` devolve "segunda" por extenso.
  const dayLabel = parsed.date && format(parsed.date, "EEEEEE · d MMM", { locale: ptBR });
  const timeLabel =
    parsed.hasTime && parsed.date ? formatClock(format(parsed.date, "HH:mm"), hour12) : null;
  const clock = zoned(parsed.date ?? undefined);
  if (!timeLabel) clock.setHours(DEFAULT_HOUR, 0, 0, 0);

  const submit = (again: boolean) => {
    if (!canSubmit) return;
    if (multi) {
      void many.createMany(drafts).then((ok) => {
        if (!ok) return;
        clear();
        onCreated?.();
      });
      return;
    }
    onSubmit({ parsed }, again);
    clear();
  };

  // O botão fica desativado durante a leitura e o foco cairia no body: volta pro campo, pro Enter.
  const askMew = () =>
    void mew.ask(input).then(() => document.getElementById("composer-text")?.focus());

  const remaining =
    mew.remaining === null
      ? null
      : mew.remaining === 1
        ? copy.mew.remainingOne
        : copy.mew.remainingMany.replace("{n}", String(mew.remaining));
  const improveLabel = remaining ? `${copy.mew.improve} · ${remaining}` : copy.mew.improve;
  const mewIcon = mew.pending ? (
    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
  ) : (
    <MewStatic className="size-4" />
  );

  // Discreta, ao lado do mic: o parser erra ~20% dos casos difíceis sem avisar, então o pedido
  // fica sempre à mão. Com motivo de dúvida, quem aparece é a linha de baixo.
  const ask =
    !online || prominent ? null : mew.exhausted ? (
      <Link
        to="/premium"
        aria-label={`${copy.mew.exhausted} · ${copy.mew.upgrade}`}
        className="relative flex size-8.5 hit-target shrink-0 items-center justify-center rounded-sm text-ink-tertiary transition-colors hover:bg-fill"
      >
        <MewStatic className="size-4" />
      </Link>
    ) : (
      <button
        type="button"
        aria-label={mew.pending ? copy.mew.pending : improveLabel}
        title={improveLabel}
        disabled={!canAsk}
        onClick={askMew}
        className="relative flex size-8.5 hit-target shrink-0 items-center justify-center rounded-sm text-ink-secondary transition-colors hover:bg-fill disabled:text-ink-tertiary disabled:hover:bg-transparent"
      >
        {mewIcon}
      </button>
    );

  const mic = voiceSupported() && (
    <button
      type="button"
      aria-label={listening ? copy.voice.stop : copy.voice.record}
      aria-pressed={listening}
      disabled={voice.state === "sending"}
      onClick={() => (listening ? voice.stop() : void voice.start())}
      className={cn(
        "relative flex size-8.5 hit-target shrink-0 items-center justify-center rounded-xl transition-colors",
        listening
          ? "bg-accent-primary text-primary-foreground hover:bg-accent-hover"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {voice.state === "sending" ? (
        <Loader2Icon className="size-4 animate-spin" aria-label={copy.voice.sending} />
      ) : listening ? (
        <SquareIcon className="size-3.5 fill-current" />
      ) : (
        <MicIcon className="size-4" />
      )}
    </button>
  );

  const send = (
    <button
      type="submit"
      aria-label={copy.composer.submit}
      disabled={!canSubmit}
      className="relative flex size-8.5 hit-target shrink-0 items-center justify-center rounded-xl bg-accent-primary text-primary-foreground transition-colors hover:bg-accent-hover disabled:bg-surface-hover disabled:text-muted-foreground"
    >
      {submitting ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        <ArrowUpIcon className="size-4" />
      )}
    </button>
  );

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <div
        className={cn(
          "transition-colors",
          large
            ? "px-2 pt-2 pb-1"
            : "rounded-field border border-surface-line bg-surface-page px-3.5 py-3 focus-within:border-accent-primary",
        )}
      >
        <Label htmlFor="composer-text" className="sr-only">
          {copy.composer.text}
        </Label>
        {/* text-base: abaixo de 16px o iOS dá zoom na página ao focar o campo. */}
        <input
          id="composer-text"
          type="text"
          value={input}
          onChange={(e) => {
            const next = e.target.value;
            setIgnore((current) => remapSpans(current, input, next));
            setInput(next);
            mew.reset();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !e.shiftKey) return;
            e.preventDefault();
            submit(true);
          }}
          maxLength={TASK_LIMITS.titleMax}
          // Gravando, o campo vira o aviso: a fala vai direto pro servidor, não pra este texto.
          readOnly={voice.state !== "idle" || mew.pending}
          placeholder={listening ? copy.voice.listening : copy.composer.textPlaceholder}
          autoComplete="off"
          className={cn(
            "w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none",
            large ? "text-2xl font-medium" : "text-base",
          )}
        />
      </div>

      {/* Slots sempre montados, na mesma ordem: chip que some e aparece mexe o layout a cada tecla. */}
      <div
        aria-live="polite"
        className={cn(
          "flex flex-wrap items-center gap-1.5 px-2",
          large ? "pt-5 pb-2" : "pt-2.5 pb-1.5",
        )}
      >
        {multi ? (
          <ul aria-label={copy.mew.drafts} className="flex w-full flex-col gap-1.5">
            {drafts.map((draft, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-ink">
                <MewStatic className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{draft.text}</span>
                <span className="shrink-0 text-xs text-ink-tertiary">
                  {draft.date
                    ? format(draft.date, "EEEEEE · d MMM", { locale: ptBR })
                    : copy.composer.toUndated}
                  {draft.hasTime &&
                    draft.date &&
                    ` · ${formatClock(format(draft.date, "HH:mm"), hour12)}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <>
            {drafts.length === 1 && <MewStatic className="size-4" title={copy.mew.draft} />}
            {recurring ? (
              <Chip
                tone={chipRepeat}
                large={large}
                editLabel={copy.composer.editRepeat.replace("{value}", repeatLabel(parsed.repeat))}
                removeLabel={copy.composer.removeRepeat}
                onRemove={() => remove("repeat")}
                editor={(trigger) => (
                  <RepeatMenu
                    value={parsed.repeat}
                    date={(parsed.date ?? zoned()).getTime()}
                    onChange={(repeat) => edit({ repeat })}
                  >
                    {trigger}
                  </RepeatMenu>
                )}
              >
                <RepeatIcon className="size-3" aria-hidden="true" />
                {repeatLabel(parsed.repeat)}
              </Chip>
            ) : (
              <Chip
                tone={dayLabel ? chipDate : chipGhost}
                large={large}
                editLabel={
                  dayLabel ? copy.composer.editDay.replace("{value}", dayLabel) : undefined
                }
                removeLabel={copy.composer.removeDay}
                onRemove={dayLabel && parsed.hasDay ? () => remove("day") : undefined}
                editor={(trigger) => (
                  <DayPopover value={parsed.date ?? zoned()} onChange={(day) => edit({ day })}>
                    {trigger}
                  </DayPopover>
                )}
              >
                {dayLabel ? (
                  <>
                    <CalendarIcon className="size-3" aria-hidden="true" />
                    {dayLabel}
                  </>
                ) : (
                  copy.composer.addDay
                )}
              </Chip>
            )}
            <Chip
              tone={timeLabel ? chipTime : chipGhost}
              large={large}
              editLabel={
                timeLabel ? copy.composer.editTime.replace("{value}", timeLabel) : undefined
              }
              removeLabel={copy.composer.removeTime}
              onRemove={timeLabel ? () => remove("time") : undefined}
              editor={(trigger) => (
                <DateTimePopover
                  timeOnly
                  value={clock}
                  onChange={(at) =>
                    edit({ time: { hour: at.getHours(), minute: at.getMinutes() } })
                  }
                >
                  {trigger}
                </DateTimePopover>
              )}
            >
              {timeLabel ? (
                <>
                  <ClockIcon className="size-3" aria-hidden="true" />
                  {timeLabel}
                </>
              ) : (
                copy.composer.addTime
              )}
            </Chip>
            <Chip
              tone={parsed.duration ? chipGot : chipGhost}
              large={large}
              editLabel={
                parsed.duration
                  ? copy.composer.editDuration.replace("{value}", parsed.duration)
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
            </Chip>
            <span
              className={cn(
                chip,
                task.alert ? "border-accent-line bg-accent-subtle text-brand-text" : chipGhost,
              )}
            >
              {task.alert ? (
                <>
                  <BellIcon className="size-3" aria-hidden="true" />
                  {format(zoned(task.alert), "EEEEEE", { locale: ptBR })}{" "}
                  {formatClock(format(zoned(task.alert), "HH:mm"), hour12)}
                </>
              ) : (
                copy.composer.addReminder
              )}
            </span>
            {parsed.links.slice(0, 1).map((url) => (
              <Chip
                key={url}
                tone={chipGot}
                large={large}
                editLabel={copy.composer.editLinks.replace("{value}", linkLabel(url))}
                removeLabel={copy.composer.removeLinks}
                onRemove={() => remove("links")}
                editor={(trigger) => (
                  <LinksPopover value={parsed.links} onChange={(links) => edit({ links })}>
                    {trigger}
                  </LinksPopover>
                )}
              >
                <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
                {linkLabel(url)}
              </Chip>
            ))}
          </>
        )}
        {large && (
          <span className="ml-auto flex items-center gap-1">
            {ask}
            {mic}
            {send}
          </span>
        )}
      </div>

      {multi && (
        <div className="px-2 pt-1">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => submit(false)}
            className="h-7 rounded-xs bg-brand px-2.5 text-xs font-medium text-on-brand transition-colors hover:bg-brand-pressed disabled:bg-fill disabled:text-ink-tertiary"
          >
            {copy.mew.confirmMany.replace("{n}", String(drafts.length))}
          </button>
        </div>
      )}

      {reply && (
        <p role="status" className="flex items-start gap-2 px-2 pt-1 text-sm text-ink-secondary">
          <MewStatic className="mt-0.5 size-4 shrink-0" />
          {reply}
        </p>
      )}

      {/* Com motivo de dúvida o pedido vira linha própria, com o porquê. */}
      {prominent && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 pt-1 text-xs">
          <button
            type="button"
            disabled={mew.exhausted || !canAsk}
            onClick={askMew}
            className="inline-flex h-7 items-center gap-1.5 rounded-xs bg-brand-soft px-2 font-medium text-brand-text transition-colors hover:text-ink disabled:bg-fill disabled:text-ink-tertiary"
          >
            {mewIcon}
            {mew.pending ? copy.mew.pending : copy.mew.improve}
          </button>
          <span className="text-ink-secondary">{copy.mew.unsure[local.unsure[0].code]}</span>
          {mew.exhausted ? (
            <Link to="/premium" className="ml-auto font-medium text-brand-text">
              {copy.mew.exhausted} · {copy.mew.upgrade}
            </Link>
          ) : (
            remaining && <span className="ml-auto text-ink-tertiary">{remaining}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
        <span>
          {copy.composer.goesTo} <b className="font-medium text-content-secondary">{destination}</b>
        </span>

        <span className="flex items-center gap-2.5">
          <span className="hidden md:inline">
            {copy.composer.hintCreate}{" "}
            <kbd className="rounded-md border border-surface-line px-1 font-mono text-2xs">⇧⏎</kbd>{" "}
            {copy.composer.hintContinue}
          </span>
          {ask}
          {mic}
          {send}
        </span>
      </div>
    </form>
  );
}
