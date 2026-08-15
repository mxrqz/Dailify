import { FormEvent, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpIcon, LinkIcon, Loader2Icon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
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

const chipClass =
  "inline-flex items-center gap-1.5 rounded-md border border-surface-line px-2 py-1 " +
  "font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground";

/**
 * Barra de captura rápida: uma frase só. O que o parser tirou dela aparece em chips embaixo — sem
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
        "rounded-[21px] border border-surface-line bg-surface-page p-[5px] transition-colors focus-within:border-accent-primary",
        className,
      )}
    >
      <div className="flex flex-col gap-2 rounded-2xl bg-surface-card p-3">
        <div className="flex items-center gap-2 rounded-2xl bg-surface-page px-3 py-2">
          <Label htmlFor="composer-text" className="sr-only">
            {copy.composer.text}
          </Label>
          {/* Enter envia, Shift+Enter quebra linha — senão duas linhas custariam o atalho. */}
          <textarea
            id="composer-text"
            value={input}
            rows={2}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
            }}
            placeholder={copy.composer.textPlaceholder}
            autoComplete="off"
            className="min-w-0 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />

          <button
            type="submit"
            aria-label={copy.composer.submit}
            disabled={!canSubmit}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-primary text-primary-foreground transition-colors hover:bg-accent-hover disabled:bg-surface-hover disabled:text-muted-foreground"
          >
            {submitting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <ArrowUpIcon className="size-4" />
            )}
          </button>
        </div>

        {input.trim() && (
          <div aria-live="polite" className="flex flex-wrap items-center gap-1.5 px-1">
            <span className={cn(chipClass, !parsed.date && "text-accent-primary")}>
              {parsed.date
                ? format(parsed.date, "EEE · d MMM · HH:mm", { locale: ptBR })
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
        )}
      </div>
    </form>
  );
}
