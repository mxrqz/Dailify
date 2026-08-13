import { useAuth, useUser } from "@clerk/clerk-react";
import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
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

      <div className="inline-flex items-center gap-3">
        <ModeToggle />

        {isFree && (
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/premium">{copy.header.upgrade}</Link>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger aria-label={copy.header.accountMenu}>
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
