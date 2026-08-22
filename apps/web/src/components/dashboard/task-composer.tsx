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
  const [focused, setFocused] = useState(false);

  const parsed = useMemo(() => parseTaskText(input), [input]);
  const canSubmit = Boolean(parsed.text && parsed.date) && !submitting;

  /**
   * Os quatro slots ficam sempre montados, na mesma ordem: chip que some/aparece pisca e mexe o
   * layout a cada tecla. Pendente aparece em destaque; respondido cai pro muted do `chipClass` —
   * o que já foi entendido não precisa mais de atenção. O título nunca vira chip: ele já está
   * inteiro no campo logo abaixo.
   */
  const slots = [
    {
      key: "text",
      chip: copy.composer.missingText,
      filled: Boolean(parsed.text),
      required: true,
    },
    {
      key: "when",
      chip: parsed.date
        ? // EEEEEE, não EEE: no locale pt-BR o `EEE` devolve "segunda" por extenso.
          format(parsed.date, parsed.hasTime ? "EEEEEE · d MMM · HH:mm" : "EEEEEE · d MMM", {
            locale: ptBR,
          })
        : copy.composer.missingWhen,
      filled: Boolean(parsed.date),
      required: true,
    },
    {
      key: "duration",
      chip: parsed.duration ?? copy.composer.missingDuration,
      filled: Boolean(parsed.duration),
      required: false,
    },
  ];

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
        "transition-[gap,border-color] duration-200 ease-out motion-reduce:transition-none",
        "focus-within:border-accent-primary",
        focused && "gap-1",
        className,
      )}
    >
      {/*
       * O eco fica montado e colapsa por grid-rows 0fr→1fr: é o que faz a ALTURA DO FORM animar,
       * já que crescimento por conteúdo novo no DOM não dispara transition. O `gap-1` do form é
       * que vai e volta com ele, senão sobraria respiro morto acima do campo com o eco fechado.
       */}
      <div
        aria-hidden={!focused}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
          "motion-reduce:transition-none",
          focused ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        {/* O `p-2` mora aqui dentro, não no item do grid: padding não encolhe com a track em 0fr
         * e deixava 16px de eco invisível segurando o composer alto quando fechado. */}
        <div className="min-h-0 overflow-hidden">
          <div aria-live="polite" className="flex flex-wrap items-center gap-1.5 p-2">
            {slots.map(({ key, chip, filled, required }) => (
              <span
                key={key}
                className={cn(
                  chipClass,
                  !filled && (required ? "text-accent-primary" : "text-content-secondary"),
                )}
              >
                {chip}
              </span>
            ))}

            {parsed.links.length ? (
              parsed.links.map((url) => (
                <span key={url} className={chipClass}>
                  <LinkIcon className="size-3 shrink-0" aria-hidden="true" />
                  {linkLabel(url)}
                </span>
              ))
            ) : (
              <span className={cn(chipClass, "text-content-secondary")}>
                {copy.composer.missingLink}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* px-7: com o min-h-19 sobram ~28px acima/abaixo do texto — o mesmo respiro nas laterais,
       * pro campo e pro botão, sai daqui (os 4px do `p-1` do form entram na conta). */}
      <div className="flex min-h-19 items-center gap-2 rounded-field bg-surface-panel px-7 py-2">
        <Label htmlFor="composer-text" className="sr-only">
          {copy.composer.text}
        </Label>
        {/* input, não textarea: a captura é de uma frase só, e o Enter já submete pelo form. */}
        <input
          id="composer-text"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
