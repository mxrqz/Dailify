import { Link } from "react-router-dom";

import { MewStatic } from "@/components/mew/mew-static";
import { cn } from "@/lib/utils";

const NAME = "Mewki";

/**
 * Logo + wordmark, compartilhado pelo header da landing, pela sidebar do desktop e pela auth. `to`
 * difere: na landing aponta pra "/", no app pro "/dashboard".
 *
 * O gato é `aria-hidden`: decorativo aqui — o wordmark ao lado já anuncia o nome. Um rótulo
 * repetindo o texto faria o leitor de tela dizer o nome duas vezes. Em `iconOnly` (auth) não há
 * wordmark, então o nome volta como `aria-label` no link, senão ele fica sem nome acessível.
 */
export function Brand({
  to,
  iconOnly,
  className,
}: {
  to: string;
  iconOnly?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <Link
      to={to}
      aria-label={iconOnly ? NAME : undefined}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <MewStatic className={cn("shrink-0", iconOnly ? "size-10" : "size-7")} />
      {!iconOnly && <span className="text-lg font-semibold tracking-tight text-ink">{NAME}</span>}
    </Link>
  );
}
