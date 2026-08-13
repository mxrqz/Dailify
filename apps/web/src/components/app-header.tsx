import { useAuth, useUser } from "@clerk/clerk-react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Brand } from "@/components/brand";
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
 * Barra do app no formato de título de janela de desktop: fina, com a marca à esquerda, o par
 * voltar/avançar logo ao lado e a conta à direita. Altura fixa em `h-10` — o `home.tsx` desconta
 * exatamente esse valor pra centralizar o composer, então mexer aqui pede mexer lá.
 */
export function AppHeader({ className }: { className?: string }): JSX.Element {
  const { signOut } = useAuth();
  const { user, isSignedIn } = useUser();
  const navigate = useNavigate();
  const isFree = user?.publicMetadata?.plan === PLAN_ID.free;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-10 w-full shrink-0 items-center gap-3 border-b border-surface-line bg-surface-page",
        className,
      )}
    >
      <Brand to="/dashboard" compact />

      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label={copy.header.back}
          onClick={() => navigate(-1)}
          className="size-6 rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label={copy.header.forward}
          onClick={() => navigate(1)}
          className="size-6 rounded-md text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      <div className="ml-auto inline-flex items-center gap-2">
        <ModeToggle className="size-6 rounded-md border-0 bg-transparent shadow-none hover:bg-surface-hover" />

        {isFree && (
          <Button
            asChild
            variant="outline"
            className="h-6 rounded-full px-3 font-mono text-2xs uppercase tracking-[0.04em]"
          >
            <Link to="/premium">{copy.header.upgrade}</Link>
          </Button>
        )}

        {!isSignedIn ? (
          <Button
            asChild
            variant="outline"
            className="h-6 rounded-full px-3 font-mono text-2xs uppercase tracking-[0.04em]"
          >
            <Link to="/login">{copy.header.signIn}</Link>
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={copy.header.accountMenu}>
              <Avatar className="size-6 cursor-pointer">
                <AvatarImage src={user?.imageUrl} alt="" />
                <AvatarFallback className="text-2xs">
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
        )}
      </div>
    </header>
  );
}
