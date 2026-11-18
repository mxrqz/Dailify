import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { XIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { cn } from "@/lib/utils";

type ChipProps = ComponentPropsWithoutRef<"button"> & {
  /** Ícone de 16px antes do texto; a cor `meta-*` vai no próprio ícone, só em chip. */
  icon?: ReactNode;
  /** `action` (raio 10, o padrão) age ou liga/desliga; `select` (cápsula) é escolha entre várias. */
  variant?: "action" | "select";
  size?: "default" | "sm";
  /** Estado de toggle/seleção: vira `aria-pressed` e o fundo `ink`. */
  pressed?: boolean;
  /** Mostra o × à direita, num botão próprio. */
  onRemove?: () => void;
  removeLabel?: string;
};

/**
 * Chip de ação/escolha. Sem `onRemove` é um botão só; com ele, dois botões lado a lado no mesmo
 * fundo — a ref e as props (o `onClick` de um `PopoverTrigger asChild`) vão pro principal.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  {
    icon,
    variant = "action",
    size = "default",
    pressed,
    onRemove,
    removeLabel = copy.kit.remove,
    className,
    children,
    ...props
  },
  ref,
) {
  const shape = variant === "select" ? "rounded-full" : "rounded-sm";
  const face = cn(
    "inline-flex flex-none items-center whitespace-nowrap font-medium tabular-nums transition-colors duration-fast [&_svg]:flex-none [&_svg:not([class*='size-'])]:size-4",
    size === "sm" ? "h-8 text-footnote" : "h-9 text-subhead",
    shape,
    pressed ? "bg-ink text-canvas" : "bg-fill text-ink hover:bg-fill-pressed",
  );
  const press = cn(
    "relative hit-target inline-flex h-full cursor-pointer items-center gap-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:text-ink-tertiary",
    shape,
  );

  const main = (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      className={cn(
        press,
        onRemove ? "pr-1 pl-3" : "px-3",
        !onRemove && face,
        !onRemove && className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
  if (!onRemove) return main;

  return (
    <span className={cn(face, className)}>
      {main}
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className={cn(press, "pr-2.5 pl-1 text-ink-secondary")}
      >
        <XIcon aria-hidden="true" className="size-3.5" />
      </button>
    </span>
  );
});
