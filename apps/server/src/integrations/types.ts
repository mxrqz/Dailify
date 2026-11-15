import type { ProviderId } from "@dailify/shared";
import type { Env } from "../index";

export interface OAuthConfig {
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl: string;
  credentials(env: Env): { id: string; secret: string };
  scopes: string[];
  /** O que tem que vir concedido: a tela de consentimento deixa a pessoa desmarcar scope. */
  required: string[];
  extraParams?: Record<string, string>;
}

export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  /** Concedidos, separados por espaço (pode ser mais que o pedido: include_granted_scopes). */
  scope: string;
}

/** O que provider e action enxergam: `api` põe o bearer e renova o token sozinho. */
export interface Ctx {
  env: Env;
  userId: string;
  api(url: string, init?: RequestInit): Promise<Response>;
}

export interface Action {
  name: string;
  kind: "read" | "write";
  run(ctx: Ctx, input: unknown): Promise<unknown>;
}

export interface Provider {
  id: ProviderId;
  oauth: OAuthConfig;
  identify(ctx: Ctx): Promise<{ accountId: string; email: string | null }>;
  actions: readonly Action[];
}
