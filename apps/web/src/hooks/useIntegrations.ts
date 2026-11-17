import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { IntegrationStatus, ProviderId } from "@dailify/shared";

import { getIntegrations } from "@/functions/api";

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
  const { getToken } = useAuth();
  const list = useSyncExternalStore(subscribe, () => current);

  useEffect(() => {
    if (current || inflight || !navigator.onLine) return;
    inflight = true;
    void (async () => {
      try {
        const token = await getToken();
        const { integrations } = token ? await getIntegrations(token) : {};
        if (integrations) setIntegrations(integrations);
      } catch {
        // Best-effort: sem status o botão só não aparece.
      } finally {
        // Falhou: a próxima linha montada tenta de novo — não há laço, só remount.
        inflight = false;
      }
    })();
  }, [getToken]);

  return list;
}

/** O Google Agenda conectado e ativo — a condição pra oferecer "Adicionar à Agenda". */
export const useCalendarReady = (): boolean =>
  useIntegrations()?.some(
    (s) => s.provider === "google-calendar" && s.connected && s.status === "active",
  ) ?? false;
