import { useSyncExternalStore } from "react";
import { startOfDay } from "date-fns";
import { zoned } from "@/functions/zone";

const MINUTE = 60_000;

// Um relógio só pro app inteiro: um interval por consumidor re-renderizava a lista toda a cada minuto.
let now = zoned();
let today = startOfDay(now);
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function tick() {
  now = zoned();
  // O início do dia só troca de identidade na virada: quem lê `"day"` não re-renderiza por minuto.
  if (startOfDay(now).getTime() !== today.getTime()) today = startOfDay(now);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    tick();
    listeners.forEach((l) => l());
  }, MINUTE);
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    clearInterval(timer);
    timer = undefined;
  };
}

/** Parado (ninguém inscrito), o relógio pode ter envelhecido: relê no minuto atual, estável dentro dele. */
function fresh() {
  if (!timer && Math.floor(Date.now() / MINUTE) !== Math.floor(now.getTime() / MINUTE)) tick();
}

/**
 * O agora, re-renderizando a cada minuto (`60_000`) ou só na virada do dia (`"day"`, que devolve o
 * início do dia). Existe pela linha do "agora": um app de agenda fica aberto o dia inteiro, e sem o
 * tick a linha congela no horário em que a página abriu.
 *
 * Não é animação — o tick NÃO deve ser desligado sob `prefers-reduced-motion`: a posição da linha
 * é dado, não movimento.
 */
export function useNow(every: typeof MINUTE | "day"): Date {
  return useSyncExternalStore(subscribe, () => {
    fresh();
    return every === "day" ? today : now;
  });
}
