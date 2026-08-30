import { useUser } from "@clerk/clerk-react";

import { copy } from "@/components/dashboard/copy";
import { DashboardButton } from "./dashboard-button";
import { PremiumButton } from "./premium-button";
import { ProfileButton } from "./profile-button";
import { SecurityButton } from "./security-button";
import { SettingsButton } from "./settings-button";
import { SignOutButton } from "./sign-out-button";

/**
 * Os destinos, sem invólucro: a coluna do desktop e a folha do mobile montam o mesmo conjunto.
 * "Sair" fica no rodapé e só existe logado — `/premium` divide este layout sem `ProtectedRoute`.
 */
export function NavItems(): JSX.Element {
  const { isSignedIn } = useUser();

  return (
    <>
      <DashboardButton />
      <ProfileButton />
      <SecurityButton />
      <PremiumButton />
      <SettingsButton />

      {isSignedIn && (
        <div className="mt-auto flex flex-col pt-1">
          <SignOutButton />
        </div>
      )}
    </>
  );
}

/** A coluna do desktop. No mobile quem serve os mesmos itens é o `MobileNav`, no header. */
export function Sidebar(): JSX.Element {
  return (
    <nav
      aria-label={copy.profile.navLabel}
      className="sticky top-10 hidden h-[calc(100dvh-2.5rem)] w-52 shrink-0 flex-col gap-0.5 border-r border-surface-line p-3 md:flex"
    >
      <NavItems />
    </nav>
  );
}
