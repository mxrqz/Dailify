import { useUser } from "@clerk/clerk-react";

import { copy } from "@/components/dashboard/copy";
import { DashboardButton } from "./dashboard-button";
import { PremiumButton } from "./premium-button";
import { ProfileButton } from "./profile-button";
import { SecurityButton } from "./security-button";
import { SettingsButton } from "./settings-button";
import { SignOutButton } from "./sign-out-button";

/**
 * Navegação do app: coluna estreita à esquerda, presente em todas as páginas (montada pelo
 * `app-layout`). Cada destino vive no próprio arquivo desta pasta; aqui só a ordem.
 *
 * "Sair" fica no rodapé e só existe logado — `/premium` divide este layout sem `ProtectedRoute`.
 */
export function Sidebar(): JSX.Element {
  const { isSignedIn } = useUser();

  return (
    <nav
      aria-label={copy.profile.navLabel}
      className="sticky top-10 hidden h-[calc(100dvh-2.5rem)] w-44 shrink-0 flex-col gap-0.5 border-r border-surface-line p-3 md:flex"
    >
      <DashboardButton />
      <ProfileButton />
      <SecurityButton />
      <PremiumButton />
      <SettingsButton />

      {isSignedIn && (
        <div className="mt-auto flex flex-col border-t border-surface-line pt-1">
          <SignOutButton />
        </div>
      )}
    </nav>
  );
}
