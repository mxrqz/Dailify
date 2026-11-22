import type { ReactNode } from "react";
import { CalendarIcon, UserIcon } from "lucide-react";
import { Link, useMatch } from "react-router-dom";

import { MobileNav } from "@/components/nav/mobile-nav";
import { SyncBadge } from "@/components/sync-badge";
import { Tip } from "@/components/tip";
import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { useCalendarView } from "@/hooks/useCalendarView";
import { useUser } from "@/hooks/useUser";
import { cn } from "@/lib/utils";

/** The Today week strip docks over this bar as it scrolls (`WeekStrip`). */
export const APP_BAR_ID = "app-bar";

/**
 * Barra do app no mobile: a barra de material do iOS (52px, ☰ à esquerda; na Hoje, calendário e
 * perfil à direita). The desktop has none: brand and history live in the sidebar, the rest in each
 * page's `Toolbar`. "Entrar" survives because `/premium` reuses the layout.
 */
export function AppHeader({ className }: { className?: string }): JSX.Element {
  const isSignedIn = Boolean(useUser());
  const dashboard = useMatch("/dashboard") !== null;
  const calendar = useCalendarView();
  const calendarLabel = calendar.open ? copy.day.closeCalendar : copy.day.openCalendar;

  return (
    <header
      id={APP_BAR_ID}
      className={cn(
        "sticky top-0 z-bar flex h-bar w-full shrink-0 items-center gap-3 bg-material-bar-solid md:hidden",
        className,
      )}
    >
      <MobileNav />
      {/* Fades as the week strip docks over the bar, all but the menu (`dock-fade`). */}
      <div className="ml-auto inline-flex items-center dock-fade">
        <SyncBadge />

        {!isSignedIn && (
          <Button asChild variant="outline" className="h-6 rounded-md px-3 caps">
            <Link to="/login">{copy.header.signIn}</Link>
          </Button>
        )}

        {dashboard && (
          <Tip content={calendarLabel}>
            <Button
              variant="ghost"
              size="bar"
              aria-label={calendarLabel}
              aria-expanded={calendar.open}
              onClick={calendar.open ? calendar.close : calendar.show}
              className="aria-expanded:bg-fill"
            >
              <CalendarIcon aria-hidden="true" />
            </Button>
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
