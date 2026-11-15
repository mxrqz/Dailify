import { FormEvent, useMemo, useState } from "react";
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
} from "lucide-react";

import { TASK_LIMITS } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Label } from "@/components/ui/label";
import { composeTaskInput } from "@/functions/compose-input";
import { parseTaskText, type ParsedTask } from "@/functions/parse-task";
import { onDay } from "@/functions/compose-input";
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
import { useDailify } from "@/components/dailifyContext";
import { formatClock } from "@/functions/functions";
import { cn } from "@/lib/utils";
import { zoned } from "@/functions/zone";

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
  /** A voz criou tarefas (direto no servidor): quem abriu a folha pode fechá-la. */
  onVoiceCreated?: () => void;
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
  onVoiceCreated,
}: TaskComposerProps): JSX.Element {
  const [input, setInput] = useState("");
  const { hour12 } = useDailify();

  const parsed = useMemo(() => onDay(parseTaskText(input), day), [input, day]);
  const task = useMemo(() => composeTaskInput(parsed, zoned()), [parsed]);
  const voice = useVoiceCreate(onVoiceCreated);
  const listening = voice.state === "recording";
  const canSubmit = Boolean(parsed.text) && !submitting && voice.state === "idle";

  const destination = !task.undated
    ? copy.composer.toAgenda
    : task.repeat !== "Off"
      ? copy.composer.toRecurring
      : copy.composer.toUndated;

  const recurring = parsed.repeat !== "Off";

  const submit = (again: boolean) => {
    if (!canSubmit) return;
    onSubmit({ parsed }, again);
    setInput("");
  };

  const pill = cn(chip, large && "py-1.5");
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
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || !e.shiftKey) return;
            e.preventDefault();
            submit(true);
          }}
          maxLength={TASK_LIMITS.titleMax}
          // Gravando, o campo vira o aviso: a fala vai direto pro servidor, não pra este texto.
          readOnly={voice.state !== "idle"}
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
        <span className={cn(pill, recurring ? chipRepeat : parsed.date ? chipDate : chipGhost)}>
          {recurring ? (
            <>
              <RepeatIcon className="size-3" aria-hidden="true" />
              {repeatLabel(parsed.repeat)}
            </>
          ) : parsed.date ? (
            <>
              <CalendarIcon className="size-3" aria-hidden="true" />
              {/* EEEEEE, não EEE: no locale pt-BR o `EEE` devolve "segunda" por extenso. */}
              {format(parsed.date, "EEEEEE · d MMM", { locale: ptBR })}
            </>
          ) : (
            copy.composer.addDay
          )}
        </span>
        <span className={cn(pill, parsed.hasTime ? chipTime : chipGhost)}>
          {parsed.hasTime && parsed.date ? (
            <>
              <ClockIcon className="size-3" aria-hidden="true" />
              {formatClock(format(parsed.date, "HH:mm"), hour12)}
            </>
          ) : (
            copy.composer.addTime
          )}
        </span>
        <span className={cn(pill, parsed.duration ? chipGot : chipGhost)}>
          {parsed.duration ?? copy.composer.addDuration}
        </span>
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
          <span key={url} className={cn(pill, chipGot)}>
            <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
            {linkLabel(url)}
          </span>
        ))}
        {large && (
          <span className="ml-auto flex items-center gap-1">
            {mic}
            {send}
          </span>
        )}
      </div>

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
          {mic}
          {send}
        </span>
      </div>
    </form>
  );
}
