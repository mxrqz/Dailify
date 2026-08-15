import { Link, useLocation } from "react-router-dom";

import { Brand } from "@/components/brand";
import { copy } from "@/components/auth/copy";

/**
 * Casca das telas de auth. O bloco (título + card) é o que fica centrado na viewport; a marca e o
 * rodapé legal ficam em `absolute` e por isso não empurram nada — tirar o logo não move o card.
 *
 * `min-h-dvh` e não `h-dvh`: com altura fixa, a marca em `bottom-full` sai por cima do topo numa
 * janela baixa. Com `min-h` a página rola.
 */
export function AuthShell({
  title,
  legalPrefix,
  crossLinkPrefix,
  crossLinkAction,
  crossLinkTo,
  children,
}: {
  /** Ausentes na /verify, que usa a mesma casca sem título, cross-link ou rodapé legal. */
  title?: string;
  legalPrefix?: string;
  crossLinkPrefix?: string;
  crossLinkAction?: string;
  crossLinkTo?: string;
  children: React.ReactNode;
}): JSX.Element {
  // O cross-link repassa o `state` que o ProtectedRoute deixou: sem isso, pular de /login pra
  // /signup perde o deep link e o usuário cai no /dashboard em vez da página que ele pediu.
  const location = useLocation();

  return (
    <main className="relative grid min-h-dvh place-items-center bg-surface-page px-4 py-24">
      <div className="relative w-full max-w-[380px]">
        <div className="absolute bottom-full left-1/2 mb-6 -translate-x-1/2">
          <Brand to="/" iconOnly />
        </div>

        {title && (
          <h1 className="mb-6 text-center text-2xl font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h1>
        )}

        <div className="flex flex-col gap-4 rounded-panel border border-surface-line bg-surface-card p-6 shadow-panel">
          {children}

          {crossLinkTo && (
            <p className="text-center text-sm text-muted-foreground">
              {crossLinkPrefix}{" "}
              <Link
                to={crossLinkTo}
                state={location.state}
                className="text-primary underline-offset-4 hover:underline"
              >
                {crossLinkAction}
              </Link>
            </p>
          )}
        </div>
      </div>

      {legalPrefix && (
        <p className="absolute inset-x-0 bottom-5 px-4 text-center text-xs text-muted-foreground">
          {legalPrefix}
          <Link to="/termos" className="underline underline-offset-4 hover:text-foreground">
            {copy.shell.terms}
          </Link>
          {copy.shell.legalAnd}
          <Link to="/privacidade" className="underline underline-offset-4 hover:text-foreground">
            {copy.shell.privacy}
          </Link>
        </p>
      )}

      {/* Obrigatório: a proteção anti-bot do Clerk é ligada por padrão no sign-up. */}
      <div id="clerk-captcha" />
    </main>
  );
}
