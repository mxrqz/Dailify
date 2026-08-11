import { useAuth, useUser } from "@clerk/clerk-react";
import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Brand } from "@/components/brand";
import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { ModeToggle } from "@/components/mode-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PLAN_ID } from "@/consts/conts";
import { cn } from "@/lib/utils";

/**
 * Header do app autenticado. Carrega o toggle Hoje/Mês — que antes era um botão de ícone sem rótulo
 * solto no meio do conteúdo (`select-day.tsx`). As pills seguem o toggle Mensal/Anual do pricing:
 * a ativa é crimson sólida (papel "view ativa"), a inativa é texto muted.
 */
function ViewToggle(): JSX.Element {
  const { isCalendar, setIsCalendar } = useDailify();
  const views = [
    { key: "day", label: copy.header.viewDay, active: !isCalendar },
    { key: "month", label: copy.header.viewMonth, active: isCalendar },
  ] as const;

  return (
    <div
      role="group"
      aria-label={`${copy.header.viewDay} / ${copy.header.viewMonth}`}
      className="inline-flex items-center gap-1 rounded-full border border-surface-line bg-surface-card p-1"
    >
      {views.map((view) => (
        <button
          key={view.key}
          type="button"
          aria-pressed={view.active}
          onClick={() => setIsCalendar(view.key === "month")}
          className={cn(
            "rounded-full px-4 py-1.5 font-mono text-2xs uppercase tracking-[0.04em] transition-colors",
            view.active
              ? "bg-accent-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

export function AppHeader({ className }: { className?: string }): JSX.Element {
  const { signOut } = useAuth();
  const { user } = useUser();
  const navigate = useNavigate();
  const isFree = user?.publicMetadata?.plan === PLAN_ID.free;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex w-full items-center justify-between gap-4 border-b border-surface-line bg-surface-page py-4",
        className,
      )}
    >
      <Brand to="/dashboard" />

      <ViewToggle />

      <div className="inline-flex items-center gap-3">
        <ModeToggle />

        {isFree && (
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/premium">{copy.header.upgrade}</Link>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="size-9 cursor-pointer">
              <AvatarImage src={user?.imageUrl} alt="" />
              <AvatarFallback>
                {user?.firstName?.slice(0, 1)}
                {user?.lastName?.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
              <UserIcon />
              <span>{copy.header.profile}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => e.preventDefault()} className="cursor-pointer">
              <SettingsIcon />
              <span>{copy.header.settings}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
              <LogOutIcon />
              <span>{copy.header.signOut}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
