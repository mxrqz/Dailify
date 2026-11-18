import { isProviderId, type ProviderId } from "@dailify/shared";
import type { Env } from "../index";
import { getConnection, listConnections, markRevoked, updateTokens } from "../db/integrations";
import { seal, unseal } from "./crypto";
import { InvalidGrantError, refresh, revoke } from "./oauth";
import { PROVIDERS } from "./registry";
import type { Ctx, Provider, Tokens } from "./types";

const aad = (userId: string, provider: ProviderId) => `${userId}:${provider}`;

export const sealTokens = (env: Env, userId: string, provider: ProviderId, tokens: Tokens) =>
  seal(env, JSON.stringify(tokens), aad(userId, provider));

function isTokens(v: unknown): v is Tokens {
  if (typeof v !== "object" || v === null) return false;
  const refreshToken = Reflect.get(v, "refreshToken");
  return (
    typeof Reflect.get(v, "accessToken") === "string" &&
    typeof Reflect.get(v, "expiresAt") === "number" &&
    typeof Reflect.get(v, "scope") === "string" &&
    (refreshToken === undefined || typeof refreshToken === "string")
  );
}

export async function openTokens(
  env: Env,
  userId: string,
  provider: ProviderId,
  sealed: string,
): Promise<Tokens> {
  const tokens: unknown = JSON.parse(await unseal(env, sealed, aad(userId, provider)));
  if (!isTokens(tokens)) throw new Error("tokens com formato inesperado");
  return tokens;
}

/** Renova ~60s antes de vencer e persiste; refresh recusado (`invalid_grant`) marca revogada. */
export function makeCtx(env: Env, userId: string, provider: Provider, tokens: Tokens): Ctx {
  // ponytail: chamadas paralelas no mesmo Ctx podem renovar duas vezes; inofensivo enquanto o
  // provider não rotaciona refresh_token (Google não). Memoizar a promise quando algum rotacionar.
  let current = tokens;
  return {
    env,
    userId,
    async api(url, init) {
      if (current.refreshToken && current.expiresAt - 60_000 <= Date.now()) {
        try {
          current = await refresh(provider.oauth, env, current);
        } catch (err) {
          if (err instanceof InvalidGrantError)
            await markRevoked(env.DB, userId, provider.id, Date.now());
          throw err;
        }
        const sealed = await sealTokens(env, userId, provider.id, current);
        await updateTokens(env.DB, userId, provider.id, sealed, Date.now());
      }
      const headers = new Headers(init?.headers);
      headers.set("authorization", `Bearer ${current.accessToken}`);
      return fetch(url, { ...init, headers, signal: init?.signal ?? AbortSignal.timeout(15_000) });
    },
  };
}

/** Ctx de uma conexão ativa, ou null se não há (ou foi revogada). */
export async function loadCtx(env: Env, userId: string, id: ProviderId): Promise<Ctx | null> {
  const row = await getConnection(env.DB, userId, id);
  if (!row || row.status !== "active") return null;
  return makeCtx(env, userId, PROVIDERS[id], await openTokens(env, userId, id, row.tokens));
}

/** Best-effort: provider fora do ar não pode segurar a desconexão nem a exclusão da conta. */
export async function revokeSealed(
  env: Env,
  userId: string,
  id: ProviderId,
  sealed: string,
): Promise<void> {
  try {
    await revoke(PROVIDERS[id].oauth, await openTokens(env, userId, id, sealed));
  } catch (err) {
    console.error(`Falha ao revogar ${id} de ${userId}`, err);
  }
}

export async function revokeAll(env: Env, userId: string): Promise<void> {
  const rows = await listConnections(env.DB, userId);
  await Promise.all(
    rows.map((r) =>
      isProviderId(r.provider) ? revokeSealed(env, userId, r.provider, r.tokens) : null,
    ),
  );
}
