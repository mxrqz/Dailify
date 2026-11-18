import type { ReactNode } from "react";
import { CheckIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { cn } from "@/lib/utils";

/** O círculo de concluir: 24px dentro de um alvo de 44, cheio de `brand` quando feito. */
export function CheckCircle({
  checked,
  onCheckedChange,
  label = checked ? copy.task.uncomplete : copy.task.complete,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className="group/check grid size-11 flex-none cursor-pointer place-items-center rounded-full outline-none"
    >
      <span
        className={cn(
          "grid size-6 place-items-center rounded-full border-2 text-on-brand transition-colors duration-base ease-out group-active/check:scale-90 group-focus-visible/check:outline-2 group-focus-visible/check:outline-offset-2 group-focus-visible/check:outline-brand-text",
          checked ? "border-brand bg-brand" : "border-ink-secondary",
        )}
      >
        <CheckIcon
          aria-hidden="true"
          strokeWidth={3}
          className={cn(
            "size-3.5 transition-[opacity,scale] duration-base ease-out",
            checked ? "opacity-100" : "scale-60 opacity-0",
          )}
        />
      </span>
    </button>
  );
}

/**
 * A linha da agenda (props → markup): horário e duração à esquerda, título e meta no meio, e à
 * direita o que vier (o círculo de concluir, a seta do Google). `live` é a tarefa em curso.
 */
export function TaskRow({
  time,
  duration,
  title,
  meta,
  done,
  live,
  muted,
  onOpen,
  trailing,
  className,
  ...props
}: {
  time: ReactNode;
  duration?: string;
  title: string;
  /** Ícones neutros e o texto curto ("Seg, Qua · Meet"). */
  meta?: ReactNode;
  done?: boolean;
  live?: boolean;
  /** Evento de fora: texto apagado, título sem peso. */
  muted?: boolean;
  onOpen?: () => void;
  trailing?: ReactNode;
  className?: string;
  role?: string;
  "aria-label"?: string;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex w-11 flex-none flex-col items-end text-subhead font-medium tabular-nums",
          live ? "text-brand-text" : done || muted ? "text-ink-secondary" : "text-ink",
        )}
      >
        {time}
        {duration && (
          <small className={cn("text-xs font-normal", !live && "text-ink-secondary")}>
            {duration}
          </small>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pl-1">
        <span
          className={cn(
            "truncate text-body",
            muted ? "font-medium text-ink-secondary" : "font-semibold",
            done && "text-ink-secondary line-through decoration-ink-tertiary",
          )}
        >
          {title}
        </span>
        {(live || meta) && (
          <span className="flex min-w-0 items-center gap-1.5 text-footnote text-ink-secondary tabular-nums [&_svg]:size-3.5 [&_svg]:flex-none">
            {live && (
              <span className="inline-flex h-5 flex-none items-center rounded-full bg-brand px-2 text-xs font-semibold text-on-brand">
                {copy.day.now}
              </span>
            )}
            {meta}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div
      {...props}
      className={cn(
        "flex min-h-16 items-center gap-2 rounded-md py-1.5 pr-1.5 pl-3",
        live ? "bg-brand-soft" : "card",
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch rounded-sm text-left outline-none focus-visible:outline-2 focus-visible:outline-brand-text"
        >
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>
      )}
      {trailing}
    </div>
  );
}
