import { Link } from "react-router-dom";
import { QUOTA_KEYS } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { quotaLabel } from "@/functions/quota-label";
import { useQuotas } from "@/hooks/useQuotas";
import { cn } from "@/lib/utils";

/**
 * As três quotas como pilhas em pé, lado a lado, enchendo de baixo pra cima. `ratio === null`
 * (ilimitado) deixa a pilha vazia — não existe fração de um teto que não existe, e desenhar 100%
 * mentiria dizendo "no limite". Quem diz o número continua sendo o `title`.
 *
 * Saiu o `<Progress>`: o Radix só sabe crescer no eixo X. Não custou semântica porque a barra já
 * era `aria-hidden` — quem carrega o nome acessível é o link em volta.
 */
export function QuotaBar(): JSX.Element | null {
  const quotas = useQuotas();
  if (quotas.loading) return null;

  return (
    <div className="hidden items-center gap-1 md:flex">
      {QUOTA_KEYS.map((key) => {
        const state = quotas.states[key];
        const label = quotaLabel(state, copy.quota.names[key], copy.quota.unlimited);

        return (
          <Link
            key={key}
            to="/premium"
            title={label}
            aria-label={label}
            className="flex flex-col items-center"
          >
            {/* O terminal: é a pontinha que faz ler como pilha em vez de barrinha em pé. */}
            <span
              className={cn(
                "h-0.5 w-1 rounded-t-xs",
                state.exhausted ? "bg-destructive" : "bg-highlight",
              )}
              aria-hidden="true"
            />

            <span
              className={cn(
                "relative block h-5 w-2 overflow-hidden rounded-xs border",
                state.exhausted ? "border-destructive" : "border-highlight",
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 transition-all",
                  state.exhausted ? "bg-destructive" : "bg-accent-primary",
                )}
                style={{ height: `${(state.ratio ?? 0) * 100}%` }}
              />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
