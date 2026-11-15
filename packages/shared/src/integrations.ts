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

/** O 400 do callback quando a pessoa desmarcou o escopo: o SPA compara pra trocar pelo recado certo. */
export const MISSING_SCOPE_ERROR = "Faltou permissão: marque o acesso à agenda na tela do Google";

export interface IntegrationStatus {
  provider: ProviderId;
  allowed: boolean;
  connected: boolean;
  status?: "active" | "revoked";
  account?: string;
}
