import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

// Separada do `<Link>` porque "Sair" é ação, não destino, e precisa das mesmas
// classes num `<button>`.
export function sidebarItemClass(active: boolean): string {
  return cn(
    "inline-flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
    active
      ? "bg-surface-hover text-foreground"
      : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  );
}

// `alsoActive`: `/premium` (escolher plano) acende "Premium", que aponta pra `/billing` (gerenciar
// assinatura) — o destaque marca o assunto, não o destino.
// O ativo é neutro de propósito: crimson aqui competiria com a ação primária do resto do app.
export function SidebarItem({
  icon: Icon,
  label,
  to,
  alsoActive,
}: {
  icon: LucideIcon;
  label: string;
  to: string;
  alsoActive?: string;
}): JSX.Element {
  const { pathname } = useLocation();
  const active = pathname === to || pathname === alsoActive;

  return (
    <Link to={to} aria-current={active ? "page" : undefined} className={sidebarItemClass(active)}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
