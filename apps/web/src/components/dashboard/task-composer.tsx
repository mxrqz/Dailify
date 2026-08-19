import { FormEvent, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpIcon, LinkIcon, Loader2Icon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { chipClass } from "@/components/dashboard/styles";
import { Label } from "@/components/ui/label";
import { parseTaskText, type ParsedTask } from "@/functions/parse-task";
import { linkLabel } from "@/functions/link-label";
import { cn } from "@/lib/utils";

export interface ComposerValues {
  parsed: ParsedTask;
}

interface TaskComposerProps {
  submitting?: boolean;
  className?: string;
  onSubmit: (values: ComposerValues) => void;
}

/**
 * Barra de captura rápida: uma frase só. O que o parser tirou dela aparece em chips no topo — sem
 * esse eco o usuário digita no escuro e só descobre no envio que a data não foi entendida.
 */
export function TaskComposer({ submitting, className, onSubmit }: TaskComposerProps): JSX.Element {
  const [input, setInput] = useState("");

  const parsed = useMemo(() => parseTaskText(input), [input]);
  const canSubmit = Boolean(parsed.text && parsed.date) && !submitting;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({ parsed });
    setInput("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col rounded-panel border border-surface-line bg-surface-page p-1",
        "transition-[gap,border-color] duration-200 ease-out focus-within:border-accent-primary",
        input.trim() && "gap-1",
        className,
      )}
    >
      {/*
       * O eco fica montado e colapsa por grid-rows 0fr→1fr: é o que faz a ALTURA DO FORM animar,
       * já que crescimento por conteúdo novo no DOM não dispara transition. O `gap-1` do form é
       * que vai e volta com ele, senão sobraria respiro morto acima do campo quando não há chip.
       */}
      <div
        aria-hidden={!input.trim()}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          input.trim() ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div aria-live="polite" className="flex flex-wrap items-center gap-1.5 overflow-hidden p-2">
          <span className={cn(chipClass, !parsed.date && "text-accent-primary")}>
            {parsed.date
              ? // EEEEEE, não EEE: no locale pt-BR o `EEE` devolve "segunda" por extenso.
                format(parsed.date, parsed.hasTime ? "EEEEEE · d MMM · HH:mm" : "EEEEEE · d MMM", {
                  locale: ptBR,
                })
              : copy.composer.missingWhen}
          </span>

          {parsed.duration && <span className={chipClass}>{parsed.duration}</span>}

          {!parsed.text && (
            <span className={cn(chipClass, "text-accent-primary")}>
              {copy.composer.missingText}
            </span>
          )}

          {parsed.links.map((url) => (
            <span key={url} className={chipClass}>
              <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
              {linkLabel(url)}
            </span>
          ))}
        </div>
      </div>

      <div className="flex min-h-19 items-center gap-2 rounded-field bg-surface-panel p-2">
        <Label htmlFor="composer-text" className="sr-only">
          {copy.composer.text}
        </Label>
        {/* input, não textarea: a captura é de uma frase só, e o Enter já submete pelo form. */}
        <input
          id="composer-text"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={copy.composer.textPlaceholder}
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />

        <button
          type="submit"
          aria-label={copy.composer.submit}
          disabled={!canSubmit}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-surface-line bg-surface-page text-accent-primary transition-colors hover:bg-surface-hover disabled:text-muted-foreground disabled:hover:bg-surface-page"
        >
          {submitting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <ArrowUpIcon className="size-4" />
          )}
        </button>
      </div>
    </form>
  );
}
