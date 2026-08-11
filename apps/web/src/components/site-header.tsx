import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

import { Brand } from "@/components/brand";
import { copy } from "@/components/dashboard/copy";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Header público da landing. Superfície sólida (o antigo era `bg-surface-header/70 backdrop-blur`,
 * contra a regra de cores sólidas do bd k00).
 */
export function SiteHeader({ className }: { className?: string }): JSX.Element {
  const { user } = useUser();

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex w-full items-center justify-between border-b border-surface-line bg-surface-page py-4",
        className,
      )}
    >
      <Brand to="/" />

      <div className="inline-flex items-center gap-3">
        <ModeToggle />
        <Button asChild className="rounded-full">
          <Link to={user ? "/dashboard" : "/login"}>
            {user ? copy.header.dashboard : copy.header.signIn}
          </Link>
        </Button>
      </div>
    </header>
  );
}
