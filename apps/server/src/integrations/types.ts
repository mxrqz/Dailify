import type { ProviderId, Task } from "@dailify/shared";
import type { StoredLink } from "../db/integrations";
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

/** Falha esperada de uma action: vira status + corpo da resposta, não o 500 genérico. */
export class ActionError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 502,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

// Métodos (não propriedades) de propósito: o parâmetro fica bivariante e `Action<Input>` cabe em
// `readonly Action[]` do registry.
export interface Action<I = unknown> {
  name: string;
  kind: "read" | "write";
  /** O schema: o input vem do cliente (ou de um rascunho da IA) e só passa validado. */
  parse(raw: unknown): { input: I } | { error: string };
  /** O que o componente de confirmação mostra, em pt-BR. */
  preview(ctx: Ctx, input: I): Promise<string>;
  run(ctx: Ctx, input: I): Promise<unknown>;
}

export interface Provider {
  id: ProviderId;
  oauth: OAuthConfig;
  identify(ctx: Ctx): Promise<{ accountId: string; email: string | null }>;
  actions: readonly Action[];
  /**
   * Tarefa vinculada mudou (`propagate`). `before` null = reenvio forçado (o retry do web); `after`
   * null = tarefa apagada. "unlink" = o objeto externo não existe mais. Falha = throw.
   */
  onTaskChanged?(
    ctx: Ctx,
    link: StoredLink,
    before: Task | null,
    after: Task | null,
  ): Promise<"unlink" | void>;
}
