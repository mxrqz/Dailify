import { useUser } from "@clerk/clerk-react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/dashboard/sidebar/mobile-nav";
import { QuotaBar } from "@/components/quota-bar";
import { SyncBadge } from "@/components/sync-badge";
import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { PLAN_ID } from "@/consts/conts";
import { cn, toText } from "@/lib/utils";

/**
 * Barra do app: `h-10` fixo — `home.tsx` desconta esse valor pra centralizar; mexer aqui mexe lá.
 * Conta e tema ficam na sidebar e em `/settings`; "Entrar" sobrevive pq `/premium` reusa o layout.
 */
export function AppHeader({ className }: { className?: string }): JSX.Element {
  const { user, isSignedIn } = useUser();
  const navigate = useNavigate();
  // `publicMetadata.plan` só nasce por webhook do Stripe: quem nunca assinou não tem o campo, e a
  // comparação crua escondia o "Assinar" justamente de quem deveria ver.
  const isFree = isSignedIn && toText(user?.publicMetadata?.plan, PLAN_ID.free) === PLAN_ID.free;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-10 w-full shrink-0 items-center gap-3 border-b border-surface-line bg-surface-page",
        className,
      )}
    >
      <MobileNav />

      {/* No mobile a marca é o centro da barra — sem sidebar à esquerda, o pl-3 que alinha
          com ela só puxaria o logo pra fora do eixo. */}
      <Brand
        to="/dashboard"
        compact
        className="absolute left-1/2 -translate-x-1/2 pl-0 md:static md:translate-x-0 md:pl-3"
      />

      <div className="hidden items-center gap-0.5 md:flex">
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
        <QuotaBar />

        <SyncBadge />

        {isFree && (
          <Button
            asChild
            variant="outline"
            className="h-6 rounded-full px-3 font-mono text-2xs uppercase tracking-[0.04em]"
          >
            <Link to="/premium">{copy.header.upgrade}</Link>
          </Button>
        )}

        {!isSignedIn && (
          <Button
            asChild
            variant="outline"
            className="h-6 rounded-full px-3 font-mono text-2xs uppercase tracking-[0.04em]"
          >
            <Link to="/login">{copy.header.signIn}</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
