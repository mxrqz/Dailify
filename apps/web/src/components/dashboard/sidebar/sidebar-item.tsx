import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

// Separada do `<Link>` porque "Sair" é ação, não destino, e precisa das mesmas
// classes num `<button>`. No celular a gaveta fecha ao tocar: nada fica aceso, só o toque.
export function sidebarItemClass(active: boolean): string {
  return cn(
    "flex h-12 w-full cursor-pointer items-center gap-3.5 rounded-md px-3 text-left text-body text-ink outline-none transition-colors duration-fast active:bg-fill-pressed md:focus-visible:bg-fill [&_svg]:size-5 [&_svg]:shrink-0",
    active
      ? "md:bg-fill-pressed md:font-semibold max-md:[&_svg]:text-ink-secondary"
      : "hover:bg-fill [&_svg]:text-ink-secondary",
  );
}

// `alsoActive`: `/premium` (escolher plano) acende "Planos", que aponta pra `/billing` (gerenciar
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
      <Icon aria-hidden="true" />
      {label}
    </Link>
  );
}
