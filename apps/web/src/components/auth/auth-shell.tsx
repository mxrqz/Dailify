import { ChevronLeftIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { copy } from "@/components/auth/copy";
import { Mew, type MewMood } from "@/components/mew/mew";
import { cn } from "@/lib/utils";

const backClass =
  "grid size-11 place-items-center rounded-full text-ink transition-colors duration-fast hover:bg-fill pointer-fine:active:bg-fill [&_svg]:size-5.5";

const EAR = "M0 12.5 L6.5 1.5 Q9 -1.5 11.5 1.5 L18 12.5";

/** O balão de fala da Mew, com as duas orelhinhas em cima e o bico apontando pra ela. */
function Bubble({ children }: { children: ReactNode }): JSX.Element {
  const part = "absolute overflow-visible fill-surface-raised stroke-separator";
  return (
    <p className="relative rounded-md bg-surface-raised px-4 py-2.5 text-body font-medium shadow-raised">
      {["left-3.5", "right-3.5"].map((side) => (
        <svg
          key={side}
          aria-hidden="true"
          viewBox="0 0 18 12"
          className={cn(part, "-top-2.75 h-3 w-4.5", side)}
        >
          <path d={EAR} strokeLinejoin="round" />
        </svg>
      ))}
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 9"
        className={cn(part, "-bottom-2 left-1/2 h-2.25 w-4 -translate-x-1/2")}
      >
        <path d="M0 -0.5 L6 7 Q8 9 10 7 L16 -0.5" strokeLinejoin="round" />
      </svg>
    </p>
  );
}

/**
 * Casca das telas de auth: voltar, a Mew com o balão, o título e o corpo numa coluna estreita, e o
 * rodapé (legal ou a dica do spam) colado embaixo. `min-h-dvh`: numa janela baixa a página rola.
 */
export function AuthShell({
  bubble,
  mood = "idle",
  title,
  subtitle,
  legalPrefix,
  footer,
  crossLinkPrefix,
  crossLinkAction,
  crossLinkTo,
  onBack,
  children,
}: {
  /** Sem balão, sem Mew (a /verify). */
  bubble?: string;
  mood?: MewMood;
  /** Ausentes na /verify e na /auth/app, que usam a casca sem título, cross-link ou rodapé legal. */
  title?: string;
  subtitle?: string;
  legalPrefix?: string;
  /** Rodapé no lugar do legal (a dica do spam na tela do e-mail enviado). */
  footer?: string;
  crossLinkPrefix?: string;
  crossLinkAction?: string;
  crossLinkTo?: string;
  /** O voltar vira botão (a caixa de entrada volta pro formulário); sem isso, vai pra landing. */
  onBack?: () => void;
  children: ReactNode;
}): JSX.Element {
  // O cross-link repassa o `state` que o ProtectedRoute deixou: sem isso, pular de /login pra
  // /signup perde o deep link e o usuário cai no /dashboard em vez da página que ele pediu.
  const location = useLocation();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <nav className="flex h-13 items-center px-2">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label={copy.shell.back} className={backClass}>
            <ChevronLeftIcon />
          </button>
        ) : (
          <Link to="/" aria-label={copy.shell.back} className={backClass}>
            <ChevronLeftIcon />
          </Link>
        )}
      </nav>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5 pt-3 pb-8">
        {bubble && (
          <div className="flex flex-col items-center gap-3.5 pt-3">
            <Bubble>{bubble}</Bubble>
            <Mew mood={mood} className="w-24" />
          </div>
        )}

        {title && <h1 className="mt-7 text-center text-title-1">{title}</h1>}
        {subtitle && (
          <p className="mt-1.5 text-center text-body leading-6 text-ink-secondary">{subtitle}</p>
        )}

        {/* Sem título, o corpo traz o próprio (a caixa de entrada põe o dela no `status`). */}
        <div className={cn("flex flex-col gap-3", title && "mt-8")}>{children}</div>

        {crossLinkTo && (
          <p className="mt-5 text-center text-subhead text-ink-secondary">
            {crossLinkPrefix}{" "}
            <Link
              to={crossLinkTo}
              state={location.state}
              className="inline-flex min-h-11 items-center font-semibold text-ink hover:underline"
            >
              {crossLinkAction}
            </Link>
          </p>
        )}
      </main>

      {(legalPrefix || footer) && (
        <p className="px-7 pb-8 text-center text-footnote text-ink-secondary">
          {footer ?? (
            <>
              {legalPrefix}
              <Link
                to="/termos"
                className="text-ink underline decoration-ink-tertiary underline-offset-3"
              >
                {copy.shell.terms}
              </Link>
              {copy.shell.legalAnd}
              <Link
                to="/privacidade"
                className="text-ink underline decoration-ink-tertiary underline-offset-3"
              >
                {copy.shell.privacy}
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
