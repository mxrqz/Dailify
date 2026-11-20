import type { ReactNode } from "react";
import { CalendarIcon, UserIcon } from "lucide-react";
import { Link, useMatch } from "react-router-dom";

import { MobileNav } from "@/components/nav/mobile-nav";
import { SyncBadge } from "@/components/sync-badge";
import { Tip } from "@/components/tip";
import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { CALENDAR_VIEW } from "@/consts/conts";
import { useSession } from "@/lib/auth";
import { cn } from "@/lib/utils";

const barButton =
  "grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-fill pointer-fine:active:bg-fill-pressed [&_svg]:size-5.5";

/**
 * Barra do app no mobile: a barra de material do iOS (52px, ☰ à esquerda; na Hoje, calendário e
 * perfil à direita). The desktop has none: brand and history live in the sidebar, the rest in each
 * page's `Toolbar`. "Entrar" survives because `/premium` reuses the layout.
 */
export function AppHeader({ className }: { className?: string }): JSX.Element {
  const isSignedIn = Boolean(useSession().data?.user);
  const dashboard = useMatch("/dashboard") !== null;

  return (
    <header
      className={cn(
        "sticky top-0 z-bar flex h-bar w-full shrink-0 items-center gap-3 bg-material-bar-solid md:hidden",
        className,
      )}
    >
      <MobileNav />

      <div className="ml-auto inline-flex items-center">
        <SyncBadge />

        {!isSignedIn && (
          <Button asChild variant="outline" className="h-6 rounded-md px-3 caps">
            <Link to="/login">{copy.header.signIn}</Link>
          </Button>
        )}

        {dashboard && (
          <Tip content={copy.day.openCalendar}>
            <Link
              to={{ search: `?view=${CALENDAR_VIEW}` }}
              aria-label={copy.day.openCalendar}
              className={barButton}
            >
              <CalendarIcon aria-hidden="true" />
            </Link>
          </Tip>
        )}

        {dashboard && isSignedIn && (
          <Button asChild variant="ghost" size="bar">
            <Link to="/profile" aria-label={copy.header.profile}>
              <UserIcon aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}

/** The desktop page toolbar (md+), sticky at the top of the main column; actions sit at the end. */
export function Toolbar({ children }: { children?: ReactNode }): JSX.Element {
  return (
    <div className="sticky top-0 z-bar hidden h-13 shrink-0 items-center justify-end gap-2 bg-canvas pr-3 pl-6 md:flex">
      <SyncBadge />
      {children}
    </div>
  );
}
