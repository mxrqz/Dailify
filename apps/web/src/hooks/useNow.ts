import { useEffect, useState } from "react";

/**
 * Relógio que re-renderiza a cada `intervalMs`. Existe pela linha do "agora": um app de agenda fica
 * aberto o dia inteiro, e sem o tick a linha congela no horário em que a página abriu.
 *
 * Não é animação — o tick NÃO deve ser desligado sob `prefers-reduced-motion`: a posição da linha
 * é dado, não movimento.
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
