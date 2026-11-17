import { useAuth, useUser } from "@clerk/clerk-react";
import { LogOutIcon } from "lucide-react";

import { copy } from "@/components/dashboard/copy";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PLAN_ID, planMap } from "@/consts/conts";
import { useQuotas } from "@/hooks/useQuotas";
import { cn, toText } from "@/lib/utils";
import { DashboardButton } from "./dashboard-button";
import { PremiumButton } from "./premium-button";
import { ProfileButton } from "./profile-button";
import { SecurityButton } from "./security-button";
import { SettingsButton } from "./settings-button";
import { sidebarItemClass } from "./sidebar-item";

/** "12 de 30 créditos de IA este mês": a barra lê o uso do mês que o servidor devolveu. */
export function CreditsMeter({ used, limit }: { used: number; limit: number }): JSX.Element {
  const name = copy.quota.names.ai;
  return (
    <div className="mx-1 rounded-md bg-fill-pressed px-3 py-3.5">
      <div className="flex items-baseline justify-between text-subhead font-semibold">
        <span>{name}</span>
        <span className="font-medium text-ink-secondary tabular-nums">
          {used}/{limit}
        </span>
      </div>
      <div
        role="meter"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-canvas"
      >
        <div
          className="h-full rounded-full bg-ink"
          style={{ width: `${Math.min(1, used / limit) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-footnote text-ink-secondary">
        {copy.profile.creditsSummary
          .replace("{used}", String(used))
          .replace("{limit}", String(limit))}
      </p>
    </div>
  );
}

/**
 * O conteúdo da navegação, só props: a coluna do desktop e a gaveta do mobile montam o mesmo.
 * Conta, créditos e "Sair" só existem logado — `/premium` divide este layout sem `ProtectedRoute`.
 */
export function NavMenu({
  account,
  credits,
  onSignOut,
}: {
  account?: { name: string; imageUrl?: string; plan: string };
  /** Sem teto (ou carregando) não há barra a mostrar. */
  credits?: { used: number; limit: number };
  onSignOut?: () => void;
}): JSX.Element {
  return (
    <>
      {account && (
        <div className="flex min-w-0 items-center gap-3 pt-1 pr-10 pb-5 pl-2">
          <Avatar className="size-12 rounded-full">
            <AvatarImage src={account.imageUrl} alt="" />
            <AvatarFallback className="rounded-full bg-fill-pressed text-xl font-semibold text-ink">
              {account.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="truncate text-body font-semibold">{account.name}</span>
            <span className="flex items-center gap-1.5 text-footnote text-ink-secondary">
              {copy.profile.planLabel}
              <span className="rounded-full bg-fill-pressed px-2 py-0.5 text-xs font-semibold text-ink">
                {account.plan}
              </span>
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        <DashboardButton />
        <ProfileButton />
        <SecurityButton />
        <PremiumButton />
        <SettingsButton />
      </div>

      {account && (
        <div className="mt-auto flex flex-col gap-2 pt-4">
          {credits && <CreditsMeter {...credits} />}
          <button
            type="button"
            onClick={onSignOut}
            className={cn(sidebarItemClass(false), "text-ink-secondary")}
          >
            <LogOutIcon aria-hidden="true" />
            {copy.profile.signOut}
          </button>
        </div>
      )}
    </>
  );
}

/** O `NavMenu` ligado ao Clerk e às quotas. */
export function NavItems(): JSX.Element {
  const { user, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const { loading, states } = useQuotas();
  const ai = states.ai;
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "";
  const plan = planMap[toText(user?.publicMetadata?.plan, PLAN_ID.free)] ?? planMap[PLAN_ID.free];

  return (
    <NavMenu
      account={isSignedIn ? { name, imageUrl: user?.imageUrl, plan } : undefined}
      credits={loading || ai.unlimited ? undefined : { used: ai.used, limit: ai.limit }}
      onSignOut={() => void signOut()}
    />
  );
}

/** A coluna do desktop. No mobile quem serve os mesmos itens é o `MobileNav`, no header. */
export function Sidebar(): JSX.Element {
  return (
    <nav
      aria-label={copy.profile.navLabel}
      className="sticky top-10 hidden h-[calc(100dvh-2.5rem)] w-64 shrink-0 flex-col border-r border-separator px-3 pt-4 pb-5 md:flex"
    >
      <NavItems />
    </nav>
  );
}
