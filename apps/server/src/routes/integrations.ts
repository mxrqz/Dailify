import { Hono, type Context } from "hono";
import {
  canUseIntegration,
  isProviderId,
  PROVIDER_IDS,
  type IntegrationStatus,
  type ProviderId,
} from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { getUserRole } from "../lib/clerk";
import { fail } from "../lib/errors";
import { appOrigin } from "../lib/origin";
import { bytesToBase64url } from "../lib/push";
import {
  consumeState,
  deleteConnection,
  getConnection,
  insertState,
  listConnections,
  upsertConnection,
  type ConnectionRow,
} from "../db/integrations";
import { PROVIDERS } from "../integrations/registry";
import { authorizeUrl, exchange, hasScopes, pkce, revoke } from "../integrations/oauth";
import { makeCtx, revokeSealed, sealTokens } from "../integrations/connection";

type Ctx = Context<{ Bindings: Env; Variables: { userId: string } }>;

const STATE_TTL = 10 * 60 * 1000;

const integrations = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
integrations.use("/integrations", requireAuth, rateLimit("API_LIMITER"));
integrations.use("/integrations/*", requireAuth, rateLimit("API_LIMITER"));

// O Google volta pro SPA, que manda {code, state} com o bearer do Clerk: é isso que amarra a conta
// externa a quem está logado (redirect direto pro worker não tem como saber quem é).
const redirectUri = (c: Ctx, id: ProviderId) =>
  `${appOrigin(c.env, c.req.header("origin"))}/integrations/${id}/callback`;

function statusOf(id: ProviderId, allowed: boolean, row?: ConnectionRow | null): IntegrationStatus {
  if (!row) return { provider: id, allowed, connected: false };
  return {
    provider: id,
    allowed,
    connected: true,
    status: row.status === "revoked" ? "revoked" : "active",
    account: row.account_email ?? undefined,
  };
}

integrations.get("/integrations", async (c) => {
  const userId = c.get("userId");
  const [role, rows] = await Promise.all([
    getUserRole(c.env, userId),
    listConnections(c.env.DB, userId),
  ]);
  return c.json(
    PROVIDER_IDS.map((id) =>
      statusOf(
        id,
        canUseIntegration(role, id),
        rows.find((r) => r.provider === id),
      ),
    ),
  );
});

integrations.post("/integrations/:provider/connect", async (c) => {
  const id = c.req.param("provider");
  if (!isProviderId(id)) return fail(c, 404, "Integração desconhecida");
  const userId = c.get("userId");
  if (!canUseIntegration(await getUserRole(c.env, userId), id))
    return fail(c, 403, "Seu plano não inclui esta integração");
  const { oauth } = PROVIDERS[id];
  if (!oauth.credentials(c.env).id) return fail(c, 503, "Integração não configurada");

  const { verifier, challenge } = await pkce();
  const state = bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await insertState(
    c.env.DB,
    state,
    { user_id: userId, provider: id, code_verifier: verifier },
    now + STATE_TTL,
    now,
  );
  return c.json({
    url: authorizeUrl(oauth, c.env, { state, challenge, redirectUri: redirectUri(c, id) }),
  });
});

integrations.post("/integrations/:provider/callback", async (c) => {
  const id = c.req.param("provider");
  if (!isProviderId(id)) return fail(c, 404, "Integração desconhecida");
  const body: unknown = await c.req.json().catch(() => null);
  const code = typeof body === "object" && body !== null ? Reflect.get(body, "code") : undefined;
  const state = typeof body === "object" && body !== null ? Reflect.get(body, "state") : undefined;
  if (typeof code !== "string" || !code || typeof state !== "string" || !state)
    return fail(c, 400, "code e state são obrigatórios");

  const userId = c.get("userId");
  const saved = await consumeState(c.env.DB, state, Date.now());
  if (!saved) return fail(c, 400, "Pedido de conexão inválido ou expirado; tente de novo");
  if (saved.user_id !== userId || saved.provider !== id)
    return fail(c, 403, "Este pedido de conexão não é seu");
  const role = await getUserRole(c.env, userId);
  if (!canUseIntegration(role, id)) return fail(c, 403, "Seu plano não inclui esta integração");

  const provider = PROVIDERS[id];
  let tokens;
  try {
    tokens = await exchange(provider.oauth, c.env, {
      code,
      verifier: saved.code_verifier,
      redirectUri: redirectUri(c, id),
    });
  } catch (err) {
    console.error(`Falha no token de ${id}`, err);
    return fail(c, 400, "Não deu pra concluir a conexão; tente de novo");
  }
  if (!hasScopes(provider.oauth, tokens.scope)) {
    await revoke(provider.oauth, tokens).catch(() => {}); // grant inútil não fica na conta da pessoa
    return fail(c, 400, "Faltou permissão: marque o acesso à agenda na tela do Google");
  }

  const account = await provider.identify(makeCtx(c.env, userId, provider, tokens));
  await upsertConnection(
    c.env.DB,
    userId,
    id,
    {
      accountId: account.accountId,
      email: account.email,
      scopes: tokens.scope,
      tokens: await sealTokens(c.env, userId, id, tokens),
    },
    Date.now(),
  );
  return c.json(statusOf(id, true, await getConnection(c.env.DB, userId, id)));
});

// Sem gate de plano: quem perdeu o plano ainda precisa conseguir desconectar.
integrations.delete("/integrations/:provider", async (c) => {
  const id = c.req.param("provider");
  if (!isProviderId(id)) return fail(c, 404, "Integração desconhecida");
  const userId = c.get("userId");
  const row = await getConnection(c.env.DB, userId, id);
  if (row) await revokeSealed(c.env, userId, id, row.tokens);
  await deleteConnection(c.env.DB, userId, id);
  return c.body(null, 204);
});

export default integrations;
