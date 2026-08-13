import { Outlet } from "react-router-dom";

import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/dashboard/sidebar";

/**
 * Casca das páginas do app: top bar em cima, sidebar à esquerda, rota no meio. Existe pra que
 * barra e navegação sejam uma só — antes cada página montava a sua, e `/premium` montava a da
 * landing.
 *
 * Declara `bg-surface-page` explicitamente: o `body` é `bg-canvas` (`global.css`), que no dark é
 * 6,5 pontos de L mais claro e tingido de azul.
 */
export function AppLayout(): JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-page text-foreground">
      <AppHeader className="px-gutter" />

      <div className="flex flex-1">
        <Sidebar />

        <div className="min-w-0 flex-1 px-gutter">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
