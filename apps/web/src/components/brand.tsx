import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

/**
 * Logo + wordmark, compartilhado pelo SiteHeader e pelo AppHeader. `to` difere: na landing aponta
 * pra "/", no app pro "/dashboard".
 *
 * O `src` é absoluto de propósito — o header antigo usava "./dailify_logo_2.png", que resolve
 * relativo à rota atual e quebra em qualquer path aninhado.
 *
 * `alt=""`: o logo é decorativo aqui — o wordmark "Dailify" ao lado já anuncia o nome. Um `alt`
 * repetindo o texto faria o leitor de tela dizer "Dailify Dailify".
 */
export function Brand({ to, compact }: { to: string; compact?: boolean }): JSX.Element {
  return (
    <Link to={to} className={cn("inline-flex items-center", compact ? "gap-1.5" : "gap-2")}>
      <img
        src="/dailify_logo_2.png"
        alt=""
        className={cn(
          "shrink-0 object-contain invert dark:invert-0",
          compact ? "size-4" : "size-7",
        )}
      />
      <span
        className={cn(
          "font-semibold tracking-[-0.01em] text-foreground",
          compact ? "text-sm" : "text-lg",
        )}
      >
        Dailify
      </span>
    </Link>
  );
}
