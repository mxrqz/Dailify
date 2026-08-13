import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export type SidebarSection = "dashboard" | "personal" | "security" | "premium" | "settings";

export interface SidebarItemProps {
  active: boolean;
}

/**
 * A forma de um item da sidebar. Cada destino tem arquivo próprio nesta pasta e só preenche
 * ícone, rótulo e rota. O ativo é neutro de propósito — crimson aqui competiria com a ação
 * primária, que é o que ele marca no resto do app.
 */
export function SidebarItem({
  icon: Icon,
  label,
  to,
  active,
}: SidebarItemProps & { icon: LucideIcon; label: string; to: string }): JSX.Element {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
        active
          ? "bg-surface-hover text-foreground"
          : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
