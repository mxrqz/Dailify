import { Outlet, useMatch } from "react-router-dom";

import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/dashboard/sidebar";
import { cn } from "@/lib/utils";

/**
 * Casca das páginas do app: top bar em cima, sidebar à esquerda, rota no meio. Existe pra que
 * barra e navegação sejam uma só — antes cada página montava a sua, e `/premium` montava a da
 * landing.
 *
 * Declara `bg-surface-page` explicitamente: o `body` é `bg-canvas` (`global.css`), que no dark é
 * 6,5 pontos de L mais claro e tingido de azul.
 *
 * O dashboard monta o próprio shell colado nas bordas, então dispensa o gutter daqui.
 */
export function AppLayout(): JSX.Element {
  const dashboard = useMatch("/dashboard") !== null;

  return (
    <div className="flex min-h-dvh flex-col bg-surface-page text-foreground">
      <AppHeader className="pl-3 pr-gutter" />

      <div className="flex flex-1">
        <Sidebar />

        <div className={cn("min-w-0 flex-1", dashboard ? "flex" : "px-gutter")}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
