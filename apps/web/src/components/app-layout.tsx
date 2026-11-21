import { Outlet, useLocation, useMatch } from "react-router-dom";

import { AppHeader } from "@/components/app-header";
import { BackBar } from "@/components/back-bar";
import { CreditsTray } from "@/components/credits-tray";
import { copy } from "@/components/dashboard/copy";
import { Sidebar } from "@/components/nav";
import { Duplicates } from "@/components/duplicates-sheet";
import { copy as pricingCopy } from "@/components/pricing/copy";
import { MOBILE } from "@/consts/media";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

// Account pages trade the ☰ bar for back + title on mobile, like the legal pages.
const BACK_BAR_TITLES: Record<string, string> = {
  "/settings": copy.profile.settingsPageTitle,
  "/integrations": copy.integrations.group,
  "/premium": pricingCopy.page.title,
  "/billing": pricingCopy.account.title,
  "/profile": copy.profile.pageTitle,
  "/security": copy.profile.securityPageTitle,
};

/**
 * Casca das páginas do app: top bar em cima, sidebar à esquerda, rota no meio. Existe pra que
 * barra e navegação sejam uma só — antes cada página montava a sua, e `/premium` montava a da
 * landing.
 *
 * O dashboard monta o próprio shell colado nas bordas, então dispensa o gutter daqui.
 */
export function AppLayout(): JSX.Element {
  const dashboard = useMatch("/dashboard") !== null;
  const { pathname } = useLocation();
  const mobile = useMediaQuery(MOBILE);
  const backTitle =
    mobile && Object.hasOwn(BACK_BAR_TITLES, pathname) ? BACK_BAR_TITLES[pathname] : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      {backTitle ? (
        <BackBar title={backTitle} fallback="/dashboard" />
      ) : (
        <AppHeader className="px-2 md:pl-3 md:pr-gutter" />
      )}

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
