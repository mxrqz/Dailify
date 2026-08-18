import { useUser } from "@clerk/clerk-react";
import { useLocation, useSearchParams } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import { DashboardButton } from "./dashboard-button";
import { PremiumButton } from "./premium-button";
import { ProfileButton } from "./profile-button";
import { SecurityButton } from "./security-button";
import { SettingsButton } from "./settings-button";
import { SignOutButton } from "./sign-out-button";
import type { SidebarSection } from "./sidebar-item";

export type { SidebarSection };

/** Qual item está aceso, lido da URL — a sidebar não guarda estado próprio. */
function useActiveSection(): SidebarSection {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  if (pathname !== "/profile") return "dashboard";

  const tab = searchParams.get("tab");
  if (tab === "security" || tab === "premium" || tab === "settings") return tab;
  return "personal";
}

/**
 * Navegação do app: coluna estreita à esquerda, presente em todas as páginas (montada pelo
 * `app-layout`). Cada destino vive no próprio arquivo desta pasta; aqui só a ordem.
 *
 * "Sair" fica no rodapé e só existe logado — `/premium` divide este layout sem `ProtectedRoute`.
 */
export function Sidebar(): JSX.Element {
  const active = useActiveSection();
  const { isSignedIn } = useUser();

  return (
    <nav
      aria-label={copy.profile.navLabel}
      className="sticky top-10 hidden h-[calc(100dvh-2.5rem)] w-44 shrink-0 flex-col gap-0.5 border-r border-surface-line p-3 md:flex"
    >
      <DashboardButton active={active === "dashboard"} />
      <ProfileButton active={active === "personal"} />
      <SecurityButton active={active === "security"} />
      <PremiumButton active={active === "premium"} />
      <SettingsButton active={active === "settings"} />

      {isSignedIn && (
        <div className="mt-auto flex flex-col border-t border-surface-line pt-1">
          <SignOutButton />
        </div>
      )}
    </nav>
  );
}
