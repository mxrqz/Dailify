import { useEffect, useSyncExternalStore } from "react";
import type { IntegrationStatus, ProviderId } from "@dailify/shared";

import { getIntegrations } from "@/functions/api";
import { useOnline } from "@/hooks/useOnline";

// Fora do contexto de propósito: cada linha da agenda lê isto, e mudar o status não pode
// re-renderizar a Home inteira. Um GET por sessão; /settings e o 409 de revogado escrevem aqui.
let current: IntegrationStatus[] | undefined;
let inflight = false;
const listeners = new Set<() => void>();

export function setIntegrations(next: IntegrationStatus[] | undefined): void {
  current = next;
  listeners.forEach((l) => l());
}

export function patchIntegration(id: ProviderId, patch: Partial<IntegrationStatus>): void {
  setIntegrations(current?.map((s) => (s.provider === id ? { ...s, ...patch } : s)));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Status das integrações; `undefined` enquanto não leu (ou offline). */
export function useIntegrations(): IntegrationStatus[] | undefined {
  const list = useSyncExternalStore(subscribe, () => current);
  // Mounted offline: reconnecting re-runs the effect; `current`/`inflight` prevent a duplicate GET.
  const online = useOnline();

  useEffect(() => {
    if (current || inflight || !online) return;
    inflight = true;
    void (async () => {
      try {
        const { integrations } = await getIntegrations();
        if (integrations) setIntegrations(integrations);
      } catch {
        // Best-effort: sem status o botão só não aparece.
      } finally {
        // Falhou: a próxima linha montada tenta de novo — não há laço, só remount.
        inflight = false;
      }
    })();
  }, [online]);

  return list;
}

/** One provider's status; `undefined` while unread, offline or not offered. */
export const useIntegration = (id: ProviderId): IntegrationStatus | undefined =>
  useIntegrations()?.find((s) => s.provider === id);

/** Connected and syncing: not revoked, not mid-reconnect. */
export const isActive = (status: IntegrationStatus | undefined): boolean =>
  !!status?.connected && status.status === "active";

/** O Google Agenda conectado e ativo — a condição pra oferecer "Adicionar à Agenda". */
export const useCalendarReady = (): boolean => isActive(useIntegration("google-calendar"));
