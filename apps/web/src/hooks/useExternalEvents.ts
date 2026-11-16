import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/clerk-react";
import { addMonths, startOfMonth } from "date-fns";
import { INTEGRATION_ERROR, type ExternalEvent } from "@dailify/shared";

import { getCalendarEvents } from "@/functions/api";
import { zoned } from "@/functions/zone";
import { patchIntegration, useCalendarReady } from "@/hooks/useIntegrations";
import { useOnline } from "@/hooks/useOnline";
import { useStoredFlag } from "@/hooks/useStoredFlag";

/** Invertido de propósito: o `useStoredFlag` nasce desligado, e os eventos nascem visíveis. */
export const HIDE_EVENTS_KEY = "dailify:google-events-hidden";
export const useHideExternalEvents = () => useStoredFlag(HIDE_EVENTS_KEY);

// Por mês (início no fuso do app), na memória da sessão: um GET por mês, nunca guardado (0xp.8).
const byMonth = new Map<number, ExternalEvent[]>();
const pending = new Map<number, AbortController>();
// O snapshot do store: refeito só quando o mapa muda, então serve de dependência estável.
let visible: ExternalEvent[] = [];
const listeners = new Set<() => void>();

const notify = () => {
  visible = [...byMonth.values()].flat().filter((e) => !e.mewkiTaskId);
  listeners.forEach((l) => l());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function abortAll(): void {
  pending.forEach((c) => c.abort());
  pending.clear();
}

/** O `reloadMonths` chama: a agenda foi relida, os eventos também são. */
export function forgetExternalEvents(): void {
  abortAll();
  byMonth.clear();
  notify();
}

/** Vinculado agora: o evento ganhou o `mewkiTaskId` no Google, e a cópia daqui também. */
export function tagExternalEvent(eventId: string, taskId: string): void {
  for (const [key, events] of byMonth)
    byMonth.set(
      key,
      events.map((e) => (e.id === eventId ? { ...e, mewkiTaskId: taskId } : e)),
    );
  notify();
}

const NONE: ExternalEvent[] = [];

/**
 * Os eventos do Google dos meses carregados, sem os da Mewki (a tarefa já aparece). Vazio com a
 * agenda desconectada, offline ou o toggle de /settings desligado. Um consumidor só (a `DayList`):
 * desmontar aborta o que está em voo.
 */
export function useExternalEvents(months: Date[]): ExternalEvent[] {
  const { getToken } = useAuth();
  const ready = useCalendarReady();
  const online = useOnline();
  const [hidden] = useHideExternalEvents();
  const events = useSyncExternalStore(subscribe, () => visible);
  const enabled = ready && online && !hidden;
  const keys = months.map((m) => startOfMonth(m).getTime()).join(",");

  useEffect(() => {
    if (!enabled || !keys) return;
    for (const key of keys.split(",").map(Number)) {
      if (byMonth.has(key) || pending.has(key)) continue;
      const controller = new AbortController();
      pending.set(key, controller);
      void (async () => {
        const token = await getToken().catch(() => null);
        const res = token
          ? await getCalendarEvents(
              token,
              key,
              addMonths(zoned(key), 1).getTime(),
              controller.signal,
            )
          : {};
        // Abortado ou trocado por um `forget`: a resposta é de antes.
        if (pending.get(key) !== controller) return;
        pending.delete(key);
        // Falha não notifica: sem laço, o mês tenta de novo quando a lista pedir outro.
        if (res.events) {
          byMonth.set(key, res.events);
          notify();
        } else if (res.error?.code === INTEGRATION_ERROR.reconnect) {
          patchIntegration("google-calendar", { status: "revoked" });
        }
      })();
    }
  }, [enabled, keys, getToken, events]);

  useEffect(() => abortAll, []);

  return enabled ? events : NONE;
}
