import { useUser } from "@clerk/clerk-react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Brand } from "@/components/brand";
import { copy } from "@/components/dashboard/copy";
import { Button } from "@/components/ui/button";
import { PLAN_ID } from "@/consts/conts";
import { cn } from "@/lib/utils";

/**
 * Barra do app no formato de título de janela de desktop: fina, com a marca à esquerda e o par
 * voltar/avançar logo ao lado. Altura fixa em `h-10` — o `home.tsx` desconta exatamente esse valor
 * pra centralizar o composer, então mexer aqui pede mexer lá.
 *
 * Conta e tema não moram aqui: perfil/configurações/sair são a sidebar, e o seletor de tema é uma
 * seção de `/profile?tab=settings`. O "Entrar" sobrevive porque `/premium` divide este layout sem
 * `ProtectedRoute`.
 */
export function AppHeader({ className }: { className?: string }): JSX.Element {
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
