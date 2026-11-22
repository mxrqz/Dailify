import {
  BlocksIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  CrownIcon,
  LayoutListIcon,
  LogOutIcon,
  MessageCircleIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { QuotaState } from "@dailify/shared";

import { Brand } from "@/components/brand";
import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { Tip } from "@/components/tip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CALENDAR_VIEW, PLAN_ID, planMap } from "@/consts/conts";
import { duration, ease } from "@/consts/motion";
import { fill, getCompletionDate, getTasksForDay } from "@/functions/functions";
import { useNow } from "@/hooks/useNow";
import { openPanel } from "@/hooks/usePanel";
import { useQuotas } from "@/hooks/useQuotas";
import { useStoredFlag } from "@/hooks/useStoredFlag";
import { useUser } from "@/hooks/useUser";
import { planOf } from "@/lib/auth";
import { signOutAndReload } from "@/lib/native-auth";
import { cn } from "@/lib/utils";
import { FADE, SidebarItem, sidebarItemClass } from "./sidebar-item";

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
 * The mobile drawer's content, props only; the desktop column is `SidebarMenu`.
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
  /** The "Assinar" upsell, shown to Free users. */
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
export function NavItems(): JSX.Element {
  const user = useUser();
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
      upgrade={planOf(user) === PLAN_ID.free}
      onSignOut={() => signOutAndReload()}
    />
  );
}

const ACCOUNT_ITEMS = [
  { icon: BlocksIcon, label: copy.profile.navIntegrations, to: "/integrations" },
  { icon: CrownIcon, label: copy.profile.navPremium, to: "/billing", alsoActive: "/premium" },
  { icon: SettingsIcon, label: copy.profile.navSettings, to: "/settings" },
];

/**
 * The desktop column, props only: brand and history on top, the app, then the account pages; at
 * the bottom credits, the Free upsell and the account menu (Perfil, Segurança, Sair).
 */
export function SidebarMenu({
  account,
  credits,
  upgrade,
  pending,
  onSignOut,
  collapsed = false,
  onCollapse,
}: {
  account?: { name: string; imageUrl?: string; plan: string };
  credits?: Credits;
  upgrade?: boolean;
  /** Today's open tasks, beside "Hoje". */
  pending?: number;
  onSignOut?: () => void;
  /** Icons only, names in tooltips; `onCollapse` toggles it. */
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}): JSX.Element {
  const navigate = useNavigate();
  const toggleLabel = collapsed ? copy.profile.expandNav : copy.profile.collapseNav;
  const ToggleIcon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;
  // Folded, what fades stays mounted (no jump) but leaves the tab order and the a11y tree.
  const folded = (el: HTMLElement | null) => el?.toggleAttribute("inert", collapsed);
  const fade = collapsed && "opacity-0";

  return (
    <>
      <div className="mb-3 flex h-11 items-center gap-1 overflow-hidden pl-2 whitespace-nowrap">
        {onCollapse && (
          <Tip content={toggleLabel} side={collapsed ? "right" : "bottom"}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={toggleLabel}
              aria-expanded={!collapsed}
              onClick={() => onCollapse(!collapsed)}
              className="shrink-0 text-ink-secondary"
            >
              <ToggleIcon aria-hidden="true" />
            </Button>
          </Tip>
        )}
        <div
          ref={folded}
          className={cn("flex min-w-0 flex-1 items-center justify-between", FADE, fade)}
        >
          <Brand to="/dashboard" />
          <div className="flex gap-0.5">
            <Tip content={copy.header.back}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={copy.header.back}
                onClick={() => navigate(-1)}
                className="text-ink-secondary"
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
            </Tip>
            <Tip content={copy.header.forward}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={copy.header.forward}
                onClick={() => navigate(1)}
                className="text-ink-secondary"
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </Tip>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <SidebarItem
          icon={LayoutListIcon}
          label={copy.profile.navDashboard}
          to="/dashboard"
          count={pending}
          collapsed={collapsed}
        />
        <SidebarItem
          icon={CalendarIcon}
          label={copy.profile.navCalendar}
          to={`/dashboard?view=${CALENDAR_VIEW}`}
          collapsed={collapsed}
        />
        <SidebarItem
          icon={MessageCircleIcon}
          label={copy.profile.navMew}
          to="/dashboard"
          onClick={() => openPanel({ kind: "mew" })}
          collapsed={collapsed}
        />
      </div>

      <hr className="mx-3.5 mt-4 border-separator" />
      <p
        ref={folded}
        className={cn(
          "px-3.5 pt-3 pb-1.5 text-footnote font-medium whitespace-nowrap text-ink-secondary",
          FADE,
          fade,
        )}
      >
        {copy.profile.navAccount}
      </p>
      <div className="flex flex-col gap-0.5">
        {ACCOUNT_ITEMS.map((item) => (
          <SidebarItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        {account && credits && (
          <div ref={folded} className={cn("overflow-hidden", FADE, fade)}>
            <CreditsMeter {...credits} />
          </div>
        )}
        {account && upgrade && (
          <Tip content={collapsed ? copy.profile.upgradePro : ""} side="right">
            <Button
              asChild
              variant="secondary"
              className="justify-start gap-3 overflow-hidden px-3.5 whitespace-nowrap"
            >
              <Link to="/premium">
                <CrownIcon aria-hidden="true" className="text-brand-text" />
                <span className={cn(FADE, fade)}>{copy.profile.upgradePro}</span>
              </Link>
            </Button>
          </Tip>
        )}
        {account ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={fill(copy.profile.accountMenu, { name: account.name })}
                className="flex h-13 w-full cursor-pointer items-center gap-2.5 overflow-hidden rounded-md px-2 text-left whitespace-nowrap transition-colors hover:bg-fill focus-ring"
              >
                <Avatar className="size-8 rounded-full">
                  <AvatarImage src={account.imageUrl} alt="" />
                  <AvatarFallback className="rounded-full bg-fill-pressed text-footnote font-semibold text-ink">
                    {account.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className={cn("flex min-w-0 flex-1 flex-col", FADE, fade)}>
                  <span className="truncate text-body font-semibold">{account.name}</span>
                  <span className="truncate text-footnote text-ink-secondary">
                    {fill(copy.profile.planName, { plan: account.plan })}
                  </span>
                </span>
                <ChevronsUpDownIcon
                  aria-hidden="true"
                  className={cn("size-4 shrink-0 text-ink-secondary", FADE, fade)}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <UserIcon aria-hidden="true" />
                  {copy.profile.navPersonal}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/security">
                  <ShieldIcon aria-hidden="true" />
                  {copy.profile.navSecurity}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onSignOut}>
                <LogOutIcon aria-hidden="true" />
                {copy.profile.signOut}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild variant="secondary" className="mx-1">
            <Link to="/login">{copy.header.signIn}</Link>
          </Button>
        )}
      </div>
    </>
  );
}

/** A coluna de vidro do desktop. No mobile quem serve a navegação é o `MobileNav`, no header. */
export function Sidebar(): JSX.Element {
  const user = useUser();
  const [collapsed, setCollapsed] = useStoredFlag("dailify:sidebar-collapsed");
  const { tasks } = useDailify();
  const { loading, states } = useQuotas();
  const today = useNow("day");
  const ai = states.ai;
  const plan = planMap[planOf(user)] ?? planMap[PLAN_ID.free];
  const pending = tasks
    ? getTasksForDay(tasks, today).filter((task) => getCompletionDate(task, today) !== true).length
    : undefined;

  return (
    <nav
      aria-label={copy.profile.navLabel}
      className={cn(
        "glass sticky top-0 hidden h-dvh shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-separator px-2 pt-2.5 pb-4 transition-[width] duration-base ease-out motion-reduce:transition-none md:flex",
        collapsed ? "w-16" : "w-62",
      )}
    >
      <SidebarMenu
        account={
          user
            ? { name: user.name || user.email, imageUrl: user.image ?? undefined, plan }
            : undefined
        }
        credits={loading || ai.unlimited ? undefined : ai}
        upgrade={planOf(user) === PLAN_ID.free}
        pending={pending}
        onSignOut={() => signOutAndReload()}
        collapsed={collapsed}
        onCollapse={setCollapsed}
      />
    </nav>
  );
}
