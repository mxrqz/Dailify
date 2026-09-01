import { useDailify } from "@/components/dailifyContext";
import { computeQuotas, type Quotas } from "@dailify/shared";

/**
 * Fonte única do gating de UI. Limites E uso vêm do servidor — o cliente contava tarefas do array
 * carregado, o que dava "0/30" toda vez que o mês não tinha carregado.
 * Lembre: isto é UX. Quem recusa de verdade é o servidor.
 */
export function useQuotas(): Quotas {
  const { quotas } = useDailify();
  return computeQuotas(quotas?.limits, quotas?.usage);
}
