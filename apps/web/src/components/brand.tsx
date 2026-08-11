import { Link } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";

/**
 * Logo + wordmark, compartilhado pelo SiteHeader e pelo AppHeader. `to` difere: na landing aponta
 * pra "/", no app pro "/dashboard".
 *
 * O `src` é absoluto de propósito — o header antigo usava "./dailify_logo_2.png", que resolve
 * relativo à rota atual e quebra em qualquer path aninhado.
 */
export function Brand({ to }: { to: string }): JSX.Element {
  return (
    <Link to={to} className="inline-flex items-center gap-2">
      <img
        src="/dailify_logo_2.png"
        alt={copy.header.logoAlt}
        className="size-7 shrink-0 object-contain invert dark:invert-0"
      />
      <span className="text-lg font-semibold tracking-[-0.01em] text-foreground">Dailify</span>
    </Link>
  );
}
