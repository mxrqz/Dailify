import { Outlet, useMatch } from "react-router-dom";

import { AppHeader, Toolbar } from "@/components/app-header";
import { CreditsTray } from "@/components/credits-tray";
import { Sidebar } from "@/components/nav";
import { Duplicates } from "@/components/duplicates-sheet";
import { cn } from "@/lib/utils";

/**
 * Casca das páginas do app: no mobile a top bar em cima; no desktop a sidebar à esquerda e a
 * `Toolbar` no topo da coluna. Existe pra que barra e navegação sejam uma só — antes cada página
 * montava a sua, e `/premium` montava a da landing.
 *
 * O dashboard monta o próprio shell (toolbar e painel lateral), então dispensa o gutter daqui.
 */
export function AppLayout(): JSX.Element {
  const dashboard = useMatch("/dashboard") !== null;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <AppHeader className="px-2" />

      <div className="flex flex-1">
        <Sidebar />

        <div className={cn("min-w-0 flex-1", dashboard ? "flex" : "px-gutter")}>
          {!dashboard && <Toolbar />}
          <Outlet />
        </div>
      </div>
      <Duplicates />
      <CreditsTray />
    </div>
  );
}
