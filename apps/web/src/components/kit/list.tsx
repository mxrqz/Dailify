import { forwardRef, useId, type HTMLAttributes, type ReactNode } from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { ArrowUpRightIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Lista agrupada do iOS: rótulo de seção, um card de linhas e uma nota embaixo. `compact` é a
 * versão de dentro de folha (raio 14, linhas de 48px), como os grupos da tarefa aberta.
 */
export function ListGroup({
  title,
  footer,
  compact,
  className,
  children,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  className?: string;
  children: ReactNode;
}): JSX.Element {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className={cn("flex flex-col", className)}>
      {title && (
        <h2 id={id} className="px-4 pb-2 text-subhead font-medium text-ink-secondary">
          {title}
        </h2>
      )}
      <div
        data-compact={compact || undefined}
        className={cn("group/list card overflow-hidden", compact ? "rounded-md" : "rounded-lg")}
      >
        {children}
      </div>
      {footer && <p className="px-4 pt-2 text-footnote text-ink-secondary">{footer}</p>}
    </section>
  );
}

type ListRowProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  /** Ícone neutro (ink-secondary) à esquerda; cor de `meta-*` só em chip pequeno, não aqui. */
  icon?: ReactNode;
  label: ReactNode;
  sublabel?: ReactNode;
  /** Valor à direita em ink-secondary ("Ter, 17 nov", "Conectado"). */
  value?: ReactNode;
  /** Controle à direita (Switch, SegmentedControl estreito). */
  trailing?: ReactNode;
  /** Controle de largura toda abaixo do rótulo (o SegmentedControl do tema). */
  below?: ReactNode;
  /** `chevron` navega; `external` sai do app (com `href`, abre em outra aba). */
  accessory?: "chevron" | "external";
  danger?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  disabled?: boolean;
  /** Vira o elemento filho (um `<Link>` do router), como o `asChild` do Radix. */
  asChild?: boolean;
  children?: ReactNode;
};

/**
 * Uma linha da lista. Vira `<a>` com `href`, `<button>` com `onClick` (é o que um `*Trigger
 * asChild` do Radix passa) e `<div>` sem nenhum dos dois. O separador é só ENTRE linhas, e começa
 * depois do ícone.
 */
export const ListRow = forwardRef<HTMLElement, ListRowProps>(function ListRow(
  {
    icon,
    label,
    sublabel,
    value,
    trailing,
    below,
    accessory,
    danger,
    asChild,
    className,
    children,
    ...props
  },
  ref,
) {
  const tag = props.href !== undefined ? "a" : props.onClick ? "button" : "div";
  // Sempre um Slot sobre o elemento escolhido: um caminho só pra ref e props, qualquer que seja a tag.
  const shell = asChild ? (
    children
  ) : tag === "a" ? (
    <a />
  ) : tag === "button" ? (
    <button type="button" />
  ) : (
    <div />
  );
  const interactive = asChild || tag !== "div";
  const external = accessory === "external" && tag === "a";
  const Accessory = accessory === "external" ? ArrowUpRightIcon : ChevronRightIcon;

  return (
    <Slot
      ref={ref}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className={cn(
        "group/row flex min-h-13 w-full items-center gap-3 px-4 text-left text-ink",
        "group-data-compact/list:min-h-12 group-data-compact/list:pr-3 group-data-compact/list:pl-3.5",
        interactive &&
          "cursor-pointer outline-none transition-colors duration-fast hover:bg-fill pointer-fine:focus-visible:bg-fill active:bg-fill-pressed disabled:cursor-default",
        className,
      )}
      {...props}
    >
      <Slottable>{shell}</Slottable>
      {icon && (
        <span
          aria-hidden="true"
          className={cn(
            "grid size-7 flex-none place-items-center text-ink-secondary [&_svg]:size-5",
            "group-data-compact/list:size-5",
            below && "mt-3 self-start",
          )}
        >
          {icon}
        </span>
      )}
      <span
        className={cn(
          "flex min-w-0 flex-1 self-stretch border-separator py-3.5 group-not-first/row:border-t",
          "group-data-compact/list:py-3",
          below ? "flex-col gap-3 pb-4" : "items-center",
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={cn("text-body", danger && "text-brand-text")}>{label}</span>
            {sublabel && <span className="text-footnote text-ink-secondary">{sublabel}</span>}
          </span>
          {value != null && (
            <span className="min-w-0 truncate text-body text-ink-secondary tabular-nums">
              {value}
            </span>
          )}
          {trailing}
          {accessory && (
            <Accessory aria-hidden="true" className="-ml-1.5 size-4 flex-none text-ink-secondary" />
          )}
        </span>
        {below}
      </span>
    </Slot>
  );
});
