import type { Env } from "../index";
import { bytesToBase64url, sha256b64url } from "../lib/encoding";
import type { OAuthConfig, Tokens } from "./types";

// OAuth2 authorization code + PKCE (S256) em fetch puro: Arctic/oslo foram deprecados e o
// googleapis é Node-only. Serve a qualquer provider que siga a RFC 6749.

/** Refresh token revogado/expirado (ou code já usado): só reconectar resolve. */
export class InvalidGrantError extends Error {}

export async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
  return { verifier, challenge: await sha256b64url(verifier) };
}

export function authorizeUrl(
  cfg: OAuthConfig,
  env: Env,
  p: { state: string; challenge: string; redirectUri: string },
): string {
  const url = new URL(cfg.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.credentials(env).id,
    redirect_uri: p.redirectUri,
    scope: cfg.scopes.join(" "),
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    ...cfg.extraParams,
  }).toString();
  return url.toString();
}

async function tokenRequest(
  cfg: OAuthConfig,
  env: Env,
  params: Record<string, string>,
  previous?: Tokens,
): Promise<Tokens> {
  const { id, secret } = cfg.credentials(env);
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ ...params, client_id: id, client_secret: secret }),
    signal: AbortSignal.timeout(15_000),
  });
  const body: unknown = await res.json().catch(() => null);
  const field = (k: string): unknown =>
    typeof body === "object" && body !== null ? Reflect.get(body, k) : undefined;

  if (field("error") === "invalid_grant") throw new InvalidGrantError("invalid_grant");
  const access = field("access_token");
  if (!res.ok || typeof access !== "string")
    throw new Error(`token endpoint ${res.status}: ${String(field("error"))}`);

  const refresh = field("refresh_token");
  const expiresIn = field("expires_in");
  const scope = field("scope");
  return {
    accessToken: access,
    // Refresh costuma não devolver refresh_token novo: o antigo continua valendo.
    refreshToken: typeof refresh === "string" ? refresh : previous?.refreshToken,
    expiresAt: Date.now() + (typeof expiresIn === "number" ? expiresIn : 3600) * 1000,
    // RFC 6749 §5.1: scope ausente = o mesmo que foi pedido.
    scope: typeof scope === "string" ? scope : (previous?.scope ?? cfg.scopes.join(" ")),
  };
}

export const exchange = (
  cfg: OAuthConfig,
  env: Env,
  p: { code: string; verifier: string; redirectUri: string },
) =>
  tokenRequest(cfg, env, {
    grant_type: "authorization_code",
    code: p.code,
    code_verifier: p.verifier,
    redirect_uri: p.redirectUri,
  });

export async function refresh(cfg: OAuthConfig, env: Env, tokens: Tokens): Promise<Tokens> {
  if (!tokens.refreshToken) throw new InvalidGrantError("sem refresh_token");
  return tokenRequest(
    cfg,
    env,
    { grant_type: "refresh_token", refresh_token: tokens.refreshToken },
    tokens,
  );
}

export async function revoke(cfg: OAuthConfig, tokens: Tokens): Promise<void> {
  const res = await fetch(cfg.revokeUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: tokens.refreshToken ?? tokens.accessToken }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`revoke ${res.status}`);
}

export const hasScopes = (cfg: OAuthConfig, granted: string) => {
  const set = new Set(granted.split(/\s+/));
  return cfg.required.every((s) => set.has(s));
};
