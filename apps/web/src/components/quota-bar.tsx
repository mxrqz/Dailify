import { Link } from "react-router-dom";
import { QUOTA_KEYS } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { Tip } from "@/components/tip";
import { quotaLabel } from "@/functions/quota-label";
import { useQuotas } from "@/hooks/useQuotas";
import { cn } from "@/lib/utils";

/**
 * As três quotas como pilhas em pé, lado a lado, enchendo de baixo pra cima. Quem diz o número é o
 * tooltip.
 *
 * Ilimitado enche a pilha, em cor neutra. Ela já ficou vazia, pelo argumento de que não existe
 * fração de um teto que não existe — o que valia numa barra deitada e parou de valer quando a barra
 * virou pilha: vazio, aqui, lê como descarregado, o oposto exato de um plano sem teto, e quem paga
 * mais via duas pilhas mortas. Neutro e não accent porque cheio-no-accent diria "no limite".
 *
 * Saiu o `<Progress>`: o Radix só sabe crescer no eixo X. Não custou semântica porque a barra já
 * era `aria-hidden` — quem carrega o nome acessível é o link em volta.
 *
 * O link vai pra `/billing`, não pra `/premium`: quem clica numa pill de quota quer saber onde está
 * — plano e uso —, e `/premium` é a página de venda, que sequer lê quem é o usuário. `/billing`
 * atende os dois lados, com o plano no topo e o CTA de upgrade pra quem é Free. É também pra onde o
 * `PremiumButton` da sidebar já apontava; a pill era a exceção. Só quem tem sessão vê a pill (sem
 * limites do servidor as quotas ficam em `loading` e isto não renderiza), então a rota protegida
 * nunca vira um desvio pro login.
 */
export function QuotaBar(): JSX.Element | null {
  const quotas = useQuotas();
  if (quotas.loading) return null;

  return (
    <div className="hidden items-center gap-1 md:flex">
      {QUOTA_KEYS.map((key) => {
        const state = quotas.states[key];
        const label = quotaLabel(state, copy.quota.names[key]);
        const fill = state.unlimited ? 1 : (state.ratio ?? 0);

        return (
          // `aria-label` fica mesmo com o tooltip repetindo o texto: as duas spans abaixo são
          // `aria-hidden`, então sem ele o link não teria nome nenhum. Descrição não é nome.
          <Tip key={key} content={label} side="bottom">
            <Link to="/billing" aria-label={label} className="flex flex-col items-center">
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
                  data-slot="quota-fill"
                  className={cn(
                    "absolute inset-x-0 bottom-0 transition-all",
                    state.exhausted
                      ? "bg-destructive"
                      : state.unlimited
                        ? "bg-muted-foreground"
                        : "bg-accent-primary",
                  )}
                  style={{ height: `${fill * 100}%` }}
                />
              </span>
            </Link>
          </Tip>
        );
      })}
    </div>
  );
}
