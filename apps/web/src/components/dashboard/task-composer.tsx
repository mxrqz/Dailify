import { FormEvent, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpIcon, BellIcon, LinkIcon, Loader2Icon, RepeatIcon } from "lucide-react";

import { TASK_LIMITS } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Label } from "@/components/ui/label";
import { composeTaskInput } from "@/functions/compose-input";
import { parseTaskText, type ParsedTask } from "@/functions/parse-task";
import { repeatLabel } from "@/functions/repeat-label";
import { linkLabel } from "@/functions/link-label";
import { cn } from "@/lib/utils";

export interface ComposerValues {
  parsed: ParsedTask;
  undatedOnly: boolean;
}

interface TaskComposerProps {
  submitting?: boolean;
  /** Folha aberta na tela Sem data: a regra de destino ignora a data/hora do parser. */
  undatedOnly?: boolean;
  /** `again`: ⇧⏎, criar e continuar — quem abriu a folha a mantém aberta. */
  onSubmit: (values: ComposerValues, again: boolean) => void;
}

const chip = "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs";
const got = "border-highlight bg-surface-hover text-foreground";
const ghost = "border-dashed border-surface-line text-muted-foreground";

/**
 * A frase da folha de criação. O que o parser tirou dela aparece em chips logo abaixo, e a linha
 * "Vai para" diz onde a tarefa cai — sem esse eco o usuário só descobre no envio que a hora não
 * foi entendida.
 */
export function TaskComposer({
  submitting,
  undatedOnly = false,
  onSubmit,
}: TaskComposerProps): JSX.Element {
  const [input, setInput] = useState("");

  const parsed = useMemo(() => parseTaskText(input), [input]);
  const task = useMemo(
    () => composeTaskInput(parsed, new Date(), { undatedOnly }),
    [parsed, undatedOnly],
  );
  const canSubmit = Boolean(parsed.text) && !submitting;

  const destination = !task.undated
    ? copy.composer.toAgenda
    : task.repeat !== "Off"
      ? copy.composer.toRecurring
      : copy.composer.toUndated;

  const recurring = parsed.repeat !== "Off";
  const hasTime = parsed.hasTime && !undatedOnly;

  const submit = (again: boolean) => {
    if (!canSubmit) return;
    onSubmit({ parsed, undatedOnly }, again);
    setInput("");
  };

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit(false);
      }}
    >
      <div className="rounded-field border border-surface-line bg-surface-page px-3.5 py-3 transition-colors focus-within:border-accent-primary">
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
          placeholder={copy.composer.textPlaceholder}
          autoComplete="off"
          className="w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>

      {/* Slots sempre montados, na mesma ordem: chip que some e aparece mexe o layout a cada tecla. */}
      <div aria-live="polite" className="flex flex-wrap gap-1.5 px-2 pt-2.5 pb-1.5">
        <span className={cn(chip, recurring || parsed.date ? got : ghost)}>
          {recurring ? (
            <>
              <RepeatIcon className="size-3" aria-hidden="true" />
              {repeatLabel(parsed.repeat)}
            </>
          ) : parsed.date ? (
            // EEEEEE, não EEE: no locale pt-BR o `EEE` devolve "segunda" por extenso.
            format(parsed.date, "EEEEEE · d MMM", { locale: ptBR })
          ) : (
            copy.composer.addDay
          )}
        </span>
        <span className={cn(chip, hasTime ? got : ghost)}>
          {hasTime && parsed.date ? format(parsed.date, "HH:mm") : copy.composer.addTime}
        </span>
        <span className={cn(chip, parsed.duration ? got : ghost)}>
          {parsed.duration ?? copy.composer.addDuration}
        </span>
        <span
          className={cn(
            chip,
            task.alert ? "border-accent-line bg-accent-subtle text-accent-primary" : ghost,
          )}
        >
          {task.alert ? (
            <>
              <BellIcon className="size-3" aria-hidden="true" />
              {format(task.alert, "EEEEEE HH:mm", { locale: ptBR })}
            </>
          ) : (
            copy.composer.addReminder
          )}
        </span>
        {parsed.links.map((url) => (
          <span key={url} className={cn(chip, got)}>
            <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
            {linkLabel(url)}
          </span>
        ))}
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
          <button
            type="submit"
            aria-label={copy.composer.submit}
            disabled={!canSubmit}
            className="flex size-8.5 shrink-0 items-center justify-center rounded-xl bg-accent-primary text-primary-foreground transition-colors hover:bg-accent-hover disabled:bg-surface-hover disabled:text-muted-foreground"
          >
            {submitting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <ArrowUpIcon className="size-4" />
            )}
          </button>
        </span>
      </div>
    </form>
  );
}
