import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Tip } from "@/components/tip";
import { cn } from "@/lib/utils";

/** What fades as the desktop sidebar folds: text that would be clipped half-way. */
export const FADE = "transition-opacity duration-base ease-out motion-reduce:transition-none";

// Separada do `<Link>` porque "Sair" é ação, não destino, e precisa das mesmas
// classes num `<button>`. No celular a gaveta fecha ao tocar: nada fica aceso, só o toque.
export function sidebarItemClass(active: boolean): string {
  return cn(
    "flex h-12 w-full cursor-pointer items-center gap-3.5 overflow-hidden rounded-md px-3 text-left whitespace-nowrap md:px-3.5 text-body text-ink outline-none transition-colors duration-fast pointer-fine:active:bg-fill-pressed md:h-10 md:gap-3 md:focus-visible:bg-fill [&_svg]:size-5 [&_svg]:shrink-0",
    active
      ? "md:bg-fill-pressed md:font-semibold max-md:[&_svg]:text-ink-secondary"
      : "hover:bg-fill [&_svg]:text-ink-secondary",
  );
}

// `alsoActive`: `/premium` (escolher plano) acende "Planos", que aponta pra `/billing` (gerenciar
// assinatura) — o destaque marca o assunto, não o destino.
// O ativo é neutro de propósito: crimson aqui competiria com a ação primária do resto do app.
// `to` may carry a query (`/dashboard?view=calendar`), so it lights against path plus search.
// An item with `onClick` is an action (open the Mew), never the current page.
export function SidebarItem({
  icon: Icon,
  label,
  to,
  alsoActive,
  count,
  onClick,
  collapsed,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
  alsoActive?: string;
  /** A trailing count (today's pending tasks); 0 shows nothing. */
  count?: number;
  onClick?: () => void;
  /** Icon only (the desktop sidebar folded): the label moves to a tooltip and the name. */
  collapsed?: boolean;
}): JSX.Element {
  const { pathname, search } = useLocation();
  const active = !onClick && (pathname + search === to || pathname === alsoActive);

  const link = (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={sidebarItemClass(active)}
    >
      <Icon aria-hidden="true" />
      {/* Stays mounted, so folding fades it while the column narrows and clips it. */}
      <span className={cn(FADE, collapsed && "opacity-0")}>{label}</span>
      {/* The space keeps the accessible name "Hoje 2", not "Hoje2"; flex drops it from layout. */}
      {!!count && " "}
      {!!count && (
        <span
          className={cn(
            "ml-auto text-footnote font-medium text-ink-secondary tabular-nums",
            FADE,
            collapsed && "opacity-0",
          )}
        >
          {count}
        </span>
      )}
    </Link>
  );
  // Only the desktop column folds (it passes `collapsed`); the drawer has no tooltips.
  return collapsed === undefined ? (
    link
  ) : (
    <Tip content={collapsed ? label : ""} side="right">
      {link}
    </Tip>
  );
}
