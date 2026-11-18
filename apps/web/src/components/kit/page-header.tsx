import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Topo de tela do iOS: a barra de material (sticky, 52px) com o que vier em `bar` e, embaixo, o
 * Large Title. Fragmento de propósito: a barra gruda no contêiner que rola, não num wrapper.
 */
export function PageHeader({
  title,
  subtitle,
  bar,
  trailing,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Conteúdo da barra (menu, voltar, ações), distribuído com `justify-between`. */
  bar?: ReactNode;
  /** Ao lado do título, alinhado à base (o anel de progresso da Hoje). */
  trailing?: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <>
      {bar && (
        <div className="sticky top-0 z-bar flex h-bar items-center justify-between bg-material-bar-solid px-2">
          {bar}
        </div>
      )}
      <header className={cn("flex items-end justify-between gap-3 px-5 pt-1", className)}>
        <div className="min-w-0">
          <h1 className="text-title-1">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-subhead font-medium text-ink-secondary">{subtitle}</p>
          )}
        </div>
        {trailing}
      </header>
    </>
  );
}
