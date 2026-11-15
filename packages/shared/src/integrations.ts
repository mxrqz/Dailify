import type { Role } from "./types";

export type ProviderId = "google-calendar";

/** Catálogo das integrações e quem pode usar cada uma. O gate é por plano, não por quota. */
export const INTEGRATIONS: Record<ProviderId, { name: string; roles: Role[] }> = {
  "google-calendar": { name: "Google Agenda", roles: ["free", "pro", "max"] },
};

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(INTEGRATIONS, value);
}

export const PROVIDER_IDS: readonly ProviderId[] = Object.keys(INTEGRATIONS).filter(isProviderId);

// admin passa em tudo, como o -1 dele nas quotas.
export const canUseIntegration = (role: Role, id: ProviderId): boolean =>
  role === "admin" || INTEGRATIONS[id].roles.includes(role);

export interface IntegrationStatus {
  provider: ProviderId;
  allowed: boolean;
  connected: boolean;
  status?: "active" | "revoked";
  account?: string;
}
