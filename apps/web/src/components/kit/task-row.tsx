import type { ReactNode } from "react";

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
        {/* Drawn, not faded in: pathLength 1 makes the dash offset a 0..1 progress. */}
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5 overflow-visible">
          <path
            d="M4 12.5l5 5L20 6.5"
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={1}
            strokeDashoffset={checked ? 0 : 1}
            className="transition-[stroke-dashoffset] duration-fast ease-out motion-reduce:transition-none"
          />
        </svg>
      </span>
    </button>
  );
}

/** The done strike draws left to right (scaleX); under reduced motion it is a plain line-through. */
export const strike = (done: boolean | undefined) =>
  cn(
    "relative w-fit max-w-full transition-colors duration-base after:absolute after:inset-x-0 after:top-1/2 after:h-px after:origin-left after:bg-ink-tertiary after:transition-transform after:duration-base after:ease-out motion-reduce:after:hidden",
    done
      ? "text-ink-secondary after:scale-x-100 motion-reduce:line-through motion-reduce:decoration-ink-tertiary"
      : "after:scale-x-0",
  );

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
  selected,
  onOpen,
  actions,
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
  /** The task open in the desktop side panel. */
  selected?: boolean;
  onOpen?: () => void;
  /** Desktop quick actions before `trailing`, shown on hover or focus (and while one is open). */
  actions?: ReactNode;
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
            strike(done),
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
        "group/row flex min-h-16 items-center gap-2 rounded-md py-1.5 pr-1.5 pl-3",
        live
          ? "bg-brand-soft"
          : selected
            ? "bg-fill-pressed outline-1 -outline-offset-1 outline-ink-tertiary"
            : "card",
        actions && !live && !selected && "transition-colors duration-fast hover:bg-fill",
        className,
      )}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-current={selected || undefined}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 self-stretch rounded-sm text-left outline-none focus-visible:outline-2 focus-visible:outline-brand-text"
        >
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2">{body}</span>
      )}
      {actions && (
        <span className="flex flex-none items-center gap-1 opacity-0 transition-opacity duration-fast group-focus-within/row:opacity-100 group-hover/row:opacity-100 has-data-[state=open]:opacity-100">
          {actions}
        </span>
      )}
      {trailing}
    </div>
  );
}
