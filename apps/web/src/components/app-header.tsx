import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, UserIcon } from "lucide-react";
import { Link, useMatch, useNavigate } from "react-router-dom";

import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/nav/mobile-nav";
import { SyncBadge } from "@/components/sync-badge";
import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { CALENDAR_VIEW, PLAN_ID } from "@/consts/conts";
import { planOf, useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

const barButton =
  "grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-fill pointer-fine:active:bg-fill-pressed [&_svg]:size-5.5 md:size-8 md:rounded-md md:text-ink-secondary md:[&_svg]:size-4";

/**
 * Barra do app: no mobile a barra de material do iOS (52px, ☰ à esquerda; na Hoje, calendário e
 * perfil à direita); no desktop `h-10` com marca e voltar/avançar. Conta e tema ficam na sidebar e
 * em `/settings`; "Entrar" sobrevive pq `/premium` reusa o layout.
 */
export function AppHeader({ className }: { className?: string }): JSX.Element {
  const user = useSession().data?.user;
  const isSignedIn = Boolean(user);
  const navigate = useNavigate();
  const isFree = isSignedIn && planOf(user) === PLAN_ID.free;
  const dashboard = useMatch("/dashboard") !== null;

  return (
    <header
      className={cn(
        "sticky top-0 z-bar flex h-bar w-full shrink-0 items-center gap-3 bg-material-bar-solid",
        "md:h-10 md:border-b md:border-separator md:bg-canvas",
        className,
      )}
    >
      <MobileNav />

      {/* No mobile a barra é só ☰ e ações, como no iOS: a marca volta com a sidebar. */}
      <Brand to="/dashboard" compact className="hidden md:inline-flex" />

      <div className="hidden items-center gap-0.5 md:flex">
        <Button
          variant="ghost"
          size="icon"
          aria-label={copy.header.back}
          onClick={() => navigate(-1)}
          className="size-6 rounded-md text-ink-secondary hover:bg-fill hover:text-ink"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={copy.header.forward}
          onClick={() => navigate(1)}
          className="size-6 rounded-md text-ink-secondary hover:bg-fill hover:text-ink"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      <div className="ml-auto inline-flex items-center md:gap-2">
        <SyncBadge />

        {isFree && (
          <Button
            asChild
            variant="outline"
            className="hidden h-6 rounded-md px-3 caps md:inline-flex"
          >
            <Link to="/premium" className="relative hit-target">
              {copy.header.upgrade}
            </Link>
          </Button>
        )}

        {!isSignedIn && (
          <Button asChild variant="outline" className="h-6 rounded-md px-3 caps">
            <Link to="/login">{copy.header.signIn}</Link>
          </Button>
        )}

        {dashboard && (
          <Link
            to={{ search: `?view=${CALENDAR_VIEW}` }}
            aria-label={copy.day.openCalendar}
            className={barButton}
          >
            <CalendarIcon aria-hidden="true" />
          </Link>
        )}

        {dashboard && isSignedIn && (
          <Link
            to="/profile"
            aria-label={copy.header.profile}
            className={cn(barButton, "md:hidden")}
          >
            <UserIcon aria-hidden="true" />
          </Link>
        )}
      </div>
    </header>
  );
}
