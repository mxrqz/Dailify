import { FormEvent, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { Label } from "@/components/ui/label";
import { parseWhen } from "@/functions/parse-when";
import { cn } from "@/lib/utils";

export interface ComposerValues {
  when: string;
  /** O que o `parseWhen` entendeu do campo "quando" — `null` quando não reconheceu nada. */
  date: Date | null;
  text: string;
}

interface TaskComposerProps {
  submitting?: boolean;
  className?: string;
  onSubmit: (values: ComposerValues) => void;
}

const fieldClass =
  "bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none";

/**
 * Barra de captura rápida: "quando" em linguagem natural + a tarefa em texto corrido, com Tab
 * entre os campos. O que o parser entendeu aparece em mono ao lado — sem esse eco o usuário
 * digita no escuro.
 */
export function TaskComposer({ submitting, className, onSubmit }: TaskComposerProps): JSX.Element {
  const [when, setWhen] = useState("");
  const [text, setText] = useState("");

  const parsed = useMemo(() => parseWhen(when), [when]);
  const echo = parsed
    ? format(parsed.date, parsed.hasTime ? "EEE · d MMM · HH:mm" : "EEE · d MMM", { locale: ptBR })
    : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    onSubmit({ when: when.trim(), date: parsed?.date ?? null, text: trimmed });
    setText("");
  };

  return (
    // Raio concêntrico: o de fora é o de dentro + os 5px de padding, senão os cantos brigam.
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-[21px] border border-surface-line bg-surface-page p-[5px] transition-colors focus-within:border-accent-primary",
        className,
      )}
    >
      <div className="flex flex-col gap-2 rounded-2xl bg-surface-card p-3">
        <div className="flex items-center gap-3">
          <Label htmlFor="composer-when" className="sr-only">
            {copy.composer.when}
          </Label>
          <input
            id="composer-when"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            placeholder={copy.composer.whenPlaceholder}
            autoComplete="off"
            className={cn(fieldClass, "w-1/3 rounded-2xl rounded-bl-lg bg-surface-page px-3 py-2")}
          />

          {echo && (
            <span
              aria-live="polite"
              className="font-mono text-2xs uppercase tracking-[0.04em] text-muted-foreground"
            >
              {echo}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 rounded-2xl rounded-tl-lg bg-surface-page px-3 py-2">
          <Label htmlFor="composer-text" className="sr-only">
            {copy.composer.text}
          </Label>
          {/* Enter envia, Shift+Enter quebra linha — senão duas linhas custariam o atalho. */}
          <textarea
            id="composer-text"
            value={text}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
            }}
            placeholder={copy.composer.textPlaceholder}
            autoComplete="off"
            className={cn(fieldClass, "min-w-0 flex-1 resize-none")}
          />

          <button
            type="submit"
            aria-label={copy.composer.submit}
            disabled={!text.trim() || submitting}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-primary text-primary-foreground transition-colors hover:bg-accent-hover disabled:bg-surface-hover disabled:text-muted-foreground"
          >
            {submitting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <ArrowUpIcon className="size-4" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
