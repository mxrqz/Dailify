import { useUser } from "@clerk/clerk-react";
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useMatch, useNavigate } from "react-router-dom";

import { Brand } from "@/components/brand";
import { useDailify } from "@/components/dailifyContext";
import { HeaderWeek } from "@/components/dashboard/header-week";
import { MobileNav } from "@/components/dashboard/sidebar/mobile-nav";
import { QuotaBar } from "@/components/quota-bar";
import { SyncBadge } from "@/components/sync-badge";
import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { PLAN_ID } from "@/consts/conts";
import { fade } from "@/consts/motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
  const { stripDocked } = useDailify();
  const mobile = useMediaQuery("(max-width: 767px)");
  const dashboard = useMatch("/dashboard") !== null;
  // No mobile a faixa da semana, ao sair de vista por baixo da barra, toma o lugar da marca.
  const week = stripDocked && mobile && dashboard;

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
      <AnimatePresence initial={false} mode="popLayout">
        {week ? (
          <HeaderWeek key="week" />
        ) : (
          <motion.div
            key="brand"
            {...fade}
            className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0"
          >
            <Brand to="/dashboard" compact className="pl-0 md:pl-3" />
          </motion.div>
        )}
      </AnimatePresence>

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

      <div className="ml-auto inline-flex shrink-0 items-center gap-2">
        <QuotaBar />

        <SyncBadge />

        {isFree && (
          <Button
            asChild
            variant="outline"
            className={cn(
              "h-6 rounded-full font-mono text-2xs uppercase tracking-[0.04em]",
              week ? "w-6 px-0" : "px-3",
            )}
          >
            {/* Com a semana no centro não sobra largura pro rótulo: fica o ícone. */}
            <Link to="/premium" aria-label={week ? copy.header.upgrade : undefined}>
              {week ? <SparklesIcon className="size-3" aria-hidden="true" /> : copy.header.upgrade}
            </Link>
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
