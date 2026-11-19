import { useState } from "react";
import { toast } from "sonner";
import type { AiParse } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { parseTaskAi } from "@/functions/api";
import { setCreditsTray } from "@/hooks/useCreditsTray";
import { useQuotas } from "@/hooks/useQuotas";

/**
 * "Melhorar com a Mew": manda o texto do composer pro `POST /tasks/parse` e guarda a leitura. Só lê —
 * quem cria é o composer, depois do Enter ou da confirmação. Nunca chamado sozinho.
 */
export function useMewParse() {
  const { bumpUsage } = useDailify();
  const ai = useQuotas().states.ai;
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AiParse | null>(null);
  // O 429 chega antes de as quotas recarregarem: sem isto o botão continuaria aceso.
  const [refused, setRefused] = useState(false);

  /** Devolve a leitura (ou `null`) pra quem pediu reagir a ela sem esperar outro render. */
  const ask = async (text: string): Promise<AiParse | null> => {
    setPending(true);
    try {
      const { result: read, error } = await parseTaskAi(text);
      if (error?.status === 429 || error?.status === 403) {
        setRefused(true);
        setCreditsTray(true);
        return null;
      }
      if (!read) {
        toast.error(copy.mew.failed, { description: copy.mew.noCredit });
        return null;
      }
      bumpUsage("ai");
      setResult(read);
      return read;
    } finally {
      setPending(false);
    }
  };

  return {
    pending,
    result,
    ask,
    reset: () => setResult(null),
    exhausted: refused || ai.exhausted,
    remaining: ai.unlimited ? null : ai.remaining,
  };
}
