import { Outlet, useMatch } from "react-router-dom";

import { AppHeader } from "@/components/app-header";
import { CreditsTray } from "@/components/credits-tray";
import { Sidebar } from "@/components/nav";
import { Duplicates } from "@/components/duplicates-sheet";
import { cn } from "@/lib/utils";

/**
 * Casca das páginas do app: top bar em cima, sidebar à esquerda, rota no meio. Existe pra que
 * barra e navegação sejam uma só — antes cada página montava a sua, e `/premium` montava a da
 * landing.
 *
 * O dashboard monta o próprio shell colado nas bordas, então dispensa o gutter daqui.
 */
export function AppLayout(): JSX.Element {
  const dashboard = useMatch("/dashboard") !== null;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <AppHeader className="px-2 md:pl-3 md:pr-gutter" />

      <div className="flex flex-1">
        <Sidebar />

        <div className={cn("min-w-0 flex-1", dashboard ? "flex" : "px-gutter")}>
          <Outlet />
        </div>
      </div>
      <Duplicates />
      <CreditsTray />
    </div>
  );
}
