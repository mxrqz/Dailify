import {
  CrownIcon,
  LayoutListIcon,
  LogOutIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { QuotaState } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PLAN_ID, planMap } from "@/consts/conts";
import { duration, ease } from "@/consts/motion";
import { fill } from "@/functions/functions";
import { useQuotas } from "@/hooks/useQuotas";
import { planOf, useSession } from "@/lib/auth";
import { signOutAndReload } from "@/lib/native-auth";
import { cn } from "@/lib/utils";
import { SidebarItem, sidebarItemClass } from "./sidebar-item";

const NAV_ITEMS = [
  { icon: LayoutListIcon, label: copy.profile.navDashboard, to: "/dashboard" },
  { icon: UserIcon, label: copy.profile.navPersonal, to: "/profile" },
  { icon: ShieldIcon, label: copy.profile.navSecurity, to: "/security" },
  { icon: CrownIcon, label: copy.profile.navPremium, to: "/billing", alsoActive: "/premium" },
  { icon: SettingsIcon, label: copy.profile.navSettings, to: "/settings" },
];

type Credits = Pick<QuotaState, "used" | "limit" | "ratio">;

/** Counts from the last shown value to `value`; the first render already shows it. */
function Count({ value }: { value: number }): JSX.Element {
  const reduce = useReducedMotion();
  const count = useMotionValue(value);
  const shown = useTransform(count, Math.round);
  useEffect(() => {
    const run = animate(
      count,
      value,
      reduce ? { duration: 0 } : { duration: duration.open, ease: ease.out },
    );
    return () => run.stop();
  }, [count, value, reduce]);
  return <motion.span>{shown}</motion.span>;
}

/** "12 de 30 créditos de IA este mês": a barra lê o uso do mês que o servidor devolveu. */
export function CreditsMeter({ used, limit, ratio }: Credits): JSX.Element {
  const name = copy.quota.names.ai;
  const bar: CSSProperties & Record<"--fill", number> = { "--fill": ratio ?? 0 };
  return (
    <div className="mx-1 rounded-md bg-fill-pressed px-3 py-3.5">
      <div className="flex items-baseline justify-between text-subhead font-semibold">
        <span>{name}</span>
        <span className="font-medium text-ink-secondary tabular-nums">
          <Count value={used} />/{limit}
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
        {/* Scale, not width: grows from 0 on mount (@starting-style) and eases to each new value. */}
        <div
          className={cn(
            "h-full origin-left scale-x-(--fill) rounded-full transition-[scale] duration-open ease-out starting:scale-x-0 motion-reduce:transition-none",
            // Under 20% left the bar takes the brand tone: a heads-up, not an alarm.
            (ratio ?? 0) > 0.8 ? "bg-brand-text" : "bg-ink",
          )}
          style={bar}
        />
      </div>
      <p className="mt-2 text-footnote text-ink-secondary">
        {fill(copy.profile.creditsSummary, { used, limit })}
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
  upgrade,
  onSignOut,
}: {
  account?: { name: string; imageUrl?: string; plan: string };
  /** Sem teto (ou carregando) não há barra a mostrar. */
  credits?: Credits;
  /** The "Assinar" upsell: the desktop has it in the header, so only the drawer asks for it. */
  upgrade?: boolean;
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
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.to} {...item} />
        ))}
      </div>

      {account && (
        <div className="mt-auto flex flex-col gap-2 pt-4">
          {credits && <CreditsMeter {...credits} />}
          {upgrade && (
            <Button asChild className="mx-1">
              <Link to="/premium">{copy.header.upgrade}</Link>
            </Button>
          )}
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

/** O `NavMenu` ligado à sessão e às quotas. */
export function NavItems({ upgrade = false }: { upgrade?: boolean }): JSX.Element {
  const user = useSession().data?.user;
  const { loading, states } = useQuotas();
  const ai = states.ai;
  const plan = planMap[planOf(user)] ?? planMap[PLAN_ID.free];

  return (
    <NavMenu
      account={
        user
          ? { name: user.name || user.email, imageUrl: user.image ?? undefined, plan }
          : undefined
      }
      credits={loading || ai.unlimited ? undefined : ai}
      upgrade={upgrade && planOf(user) === PLAN_ID.free}
      onSignOut={() => signOutAndReload()}
    />
  );
}

/** A coluna do desktop. No mobile quem serve os mesmos itens é o `MobileNav`, no header. */
export function Sidebar(): JSX.Element {
  return (
    <nav
      aria-label={copy.profile.navLabel}
      className="sticky top-(--bar-desktop) hidden h-below-bar w-64 shrink-0 flex-col border-r border-separator px-3 pt-4 pb-5 md:flex"
    >
      <NavItems />
    </nav>
  );
}
