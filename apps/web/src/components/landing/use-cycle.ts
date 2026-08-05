import { useEffect, useState } from "react";

/**
 * Relógio único pra animações em loop sincronizadas — "o mesmo trigger".
 *
 * Um `setInterval`, uma fonte de verdade: todo elemento que lê o índice retornado avança no
 * mesmo tick, então não há como dessincronizar (não existem múltiplos timers pra derivar). Retorna
 * o índice ativo em `[0, count)`, com wrap. `enabled=false` (ex.: prefers-reduced-motion) congela
 * no 0 — o estado estático.
 *
 * Pra sincronizar VÁRIOS elementos, chame `useCycle` UMA vez num ancestral comum e passe o índice
 * pra baixo — dois `useCycle` separados são dois intervals e podem driftar.
 *
 * ponytail: um interval por consumidor; se precisar de vários consumidores independentes no mesmo
 * clock, elevar pra um provider/context de clock compartilhado.
 */
export function useCycle(count: number, intervalMs: number, enabled = true): number {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!enabled || count <= 0) return;
    const id = setInterval(() => setI((prev) => (prev + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [count, intervalMs, enabled]);

  return count > 0 ? i % count : 0;
}
