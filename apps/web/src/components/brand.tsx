import { Link } from "react-router-dom";

import { MewStatic } from "@/components/mew/mew-static";
import { cn } from "@/lib/utils";

const NAME = "Mewki";

/**
 * Logo + wordmark, compartilhado pelo header da landing, pelo AppHeader e pela auth. `to` difere:
 * na landing aponta pra "/", no app pro "/dashboard".
 *
 * `compact` é o header do app, que fica logo acima da sidebar: o `pl-3` e o `gap-3` repetem o
 * `px-3`/`gap-3` do `sidebar-item` de propósito — sem eles a marca cai 10px à esquerda dos
 * ícones da nav e a coluna fica torta.
 *
 * O gato é `aria-hidden`: decorativo aqui — o wordmark ao lado já anuncia o nome. Um rótulo
 * repetindo o texto faria o leitor de tela dizer o nome duas vezes. Em `iconOnly` (auth) não há
 * wordmark, então o nome volta como `aria-label` no link, senão ele fica sem nome acessível.
 */
export function Brand({
  to,
  compact,
  iconOnly,
  className,
}: {
  to: string;
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <Link
      to={to}
      aria-label={iconOnly ? NAME : undefined}
      className={cn("inline-flex items-center", compact ? "gap-3 pl-3" : "gap-2", className)}
    >
      <MewStatic className={cn("shrink-0", iconOnly ? "size-10" : compact ? "size-4" : "size-7")} />
      {!iconOnly && (
        <span
          className={cn(
            "font-semibold tracking-[-0.01em] text-foreground",
            // no header do app o wordmark só volta com a sidebar: sr-only (não hidden) pra o link
            // não ficar sem nome acessível no mobile
            compact ? "text-sm sr-only md:not-sr-only" : "text-lg",
          )}
        >
          {NAME}
        </span>
      )}
    </Link>
  );
}
