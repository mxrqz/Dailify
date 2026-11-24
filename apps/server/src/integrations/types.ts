import type { MewCard, ProviderId, Task } from "@dailify/shared";
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
  /**
   * Slack's user token: scopes go comma-joined in `user_scope`, the token comes back in
   * `authed_user`, and no PKCE (turning it on makes the Slack app a public client for good).
   */
  userToken?: true;
  /** Replaces the RFC 7009 POST to `revokeUrl` (GitHub: DELETE the grant with basic auth). */
  revoke?(env: Env, tokens: Tokens): Promise<void>;
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

export interface Provider {
  id: ProviderId;
  oauth: OAuthConfig;
  identify(ctx: Ctx): Promise<{ accountId: string; email: string | null }>;
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
  /** The import right after connecting; the callback answers its `imported` count. */
  sync?(env: Env, userId: string): Promise<{ imported: number }>;
  /** What `target` names for `read`/`send`, for the Mew prompt ("channel id"). */
  target?: string;
  /** Text the Mew may read once the user allows it. Untrusted: it goes in as user-role data. */
  read?(env: Env, userId: string, target: string): Promise<{ text: string; card?: MewCard }>;
  /** Runs only after the user confirmed the draft in a `send` box. */
  send?(env: Env, userId: string, target: string, text: string): Promise<void>;
}
