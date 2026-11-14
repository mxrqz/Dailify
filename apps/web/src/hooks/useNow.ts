import { useEffect, useState } from "react";
import { zoned } from "@/functions/zone";

/**
 * Relógio que re-renderiza a cada `intervalMs`. Existe pela linha do "agora": um app de agenda fica
 * aberto o dia inteiro, e sem o tick a linha congela no horário em que a página abriu.
 *
 * Não é animação — o tick NÃO deve ser desligado sob `prefers-reduced-motion`: a posição da linha
 * é dado, não movimento.
 */
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => zoned());

  useEffect(() => {
    const id = setInterval(() => setNow(zoned()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
