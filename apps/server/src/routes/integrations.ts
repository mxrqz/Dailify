import { Hono, type Context } from "hono";
import { IANAZone } from "luxon";
import {
  canUseIntegration,
  INTEGRATION_ERROR,
  isProviderId,
  MISSING_SCOPE_ERROR,
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
  listStale,
  listTaskLinks,
  upsertConnection,
  type ConnectionRow,
} from "../db/integrations";
import { PROVIDERS } from "../integrations/registry";
import {
  authorizeUrl,
  exchange,
  hasScopes,
  InvalidGrantError,
  pkce,
  revoke,
} from "../integrations/oauth";
import { loadCtx, makeCtx, revokeSealed, sealTokens } from "../integrations/connection";
import { pushLink } from "../integrations/propagate";
import { getTask } from "../db/tasks";
import { createEvent, linkEvent, listEvents } from "../integrations/google-calendar";
import { ActionError, type Ctx as ProviderCtx } from "../integrations/types";

type Ctx = Context<{ Bindings: Env; Variables: { userId: string } }>;

const STATE_TTL = 10 * 60 * 1000;

const integrations = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
integrations.use("/integrations", requireAuth, rateLimit("API_LIMITER"));
integrations.use("/integrations/*", requireAuth, rateLimit("API_LIMITER"));

// O Google volta pro SPA, que manda {code, state} com o bearer do Clerk: é isso que amarra a conta
// externa a quem está logado (redirect direto pro worker não tem como saber quem é).
const redirectUri = (c: Ctx, id: ProviderId) =>
  `${appOrigin(c.env, c.req.header("origin"))}/integrations/${id}/callback`;

function statusOf(
  env: Env,
  id: ProviderId,
  allowed: boolean,
  row?: ConnectionRow | null,
  stale: string[] = [],
): IntegrationStatus {
  const configured = Boolean(PROVIDERS[id].oauth.credentials(env).id);
  if (!row) return { provider: id, allowed, configured, connected: false };
  return {
    provider: id,
    allowed,
    configured,
    connected: true,
    status: row.status === "revoked" ? "revoked" : "active",
    account: row.account_email ?? undefined,
    ...(stale.length && { stale }),
  };
}

integrations.get("/integrations", async (c) => {
  const userId = c.get("userId");
  const [role, rows, stale] = await Promise.all([
    getUserRole(c.env, userId),
    listConnections(c.env.DB, userId),
    listStale(c.env.DB, userId),
  ]);
  return c.json(
    PROVIDER_IDS.map((id) =>
      statusOf(
        c.env,
        id,
        canUseIntegration(role, id),
        rows.find((r) => r.provider === id),
        stale.filter((s) => s.provider === id).map((s) => s.task_id),
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
    return fail(c, 400, MISSING_SCOPE_ERROR);
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
  return c.json(statusOf(c.env, id, true, await getConnection(c.env.DB, userId, id)));
});

const RECONNECT = "Reconecte o Google Agenda para continuar";

/** Plano + conexão ativa + os erros esperados do Google, iguais em toda rota que fala com ele. */
async function withCalendar(c: Ctx, run: (ctx: ProviderCtx) => Promise<unknown>) {
  const userId = c.get("userId");
  if (!canUseIntegration(await getUserRole(c.env, userId), "google-calendar"))
    return fail(c, 403, "Seu plano não inclui esta integração");
  const ctx = await loadCtx(c.env, userId, "google-calendar");
  if (!ctx) return fail(c, 409, RECONNECT, { code: INTEGRATION_ERROR.reconnect });
  try {
    return c.json(await run(ctx));
  } catch (err) {
    if (err instanceof ActionError) return fail(c, err.status, err.message, err.extra);
    // O refresh recusado já marcou a conexão revogada (`makeCtx`).
    if (err instanceof InvalidGrantError)
      return fail(c, 409, RECONNECT, { code: INTEGRATION_ERROR.reconnect });
    throw err;
  }
}

const field = (body: unknown, key: string): unknown =>
  typeof body === "object" && body !== null ? Reflect.get(body, key) : undefined;

integrations.post("/integrations/google-calendar/events", async (c) => {
  const parsed = createEvent.parse(await c.req.json().catch(() => null));
  if ("error" in parsed) return fail(c, 400, parsed.error);
  return withCalendar(c, (ctx) => createEvent.run(ctx, parsed.input));
});

// Leitura sob demanda da janela visível (0xp.8): nada é guardado, a janela passa de 62 dias cortada.
integrations.get("/integrations/google-calendar/events", async (c) => {
  const from = Number(c.req.query("from"));
  const to = Number(c.req.query("to"));
  const timeZone = c.req.query("tz") ?? "";
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || to <= from)
    return fail(c, 400, "Janela inválida");
  if (!IANAZone.isValidZone(timeZone)) return fail(c, 400, "Fuso inválido");
  return withCalendar(c, async (ctx) => ({
    events: await listEvents(ctx, { from, to, timeZone }),
  }));
});

integrations.post("/integrations/google-calendar/links", async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const taskId = field(body, "taskId");
  const eventId = field(body, "eventId");
  const timeZone = field(body, "timezone");
  if (typeof taskId !== "string" || !taskId || typeof eventId !== "string" || !eventId)
    return fail(c, 400, "taskId e eventId são obrigatórios");
  if (typeof timeZone !== "string" || !IANAZone.isValidZone(timeZone))
    return fail(c, 400, "Fuso inválido");
  return withCalendar(c, (ctx) => linkEvent(ctx, { taskId, eventId, timeZone }));
});

// O retry do "não sincronizado": reenvia agora, sem comparar, no fuso que o aparelho mandar.
integrations.post("/integrations/google-calendar/events/:taskId/sync", async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const timeZone = typeof body === "object" && body !== null ? Reflect.get(body, "timezone") : null;
  if (typeof timeZone !== "string" || !IANAZone.isValidZone(timeZone))
    return fail(c, 400, "Fuso inválido");
  const userId = c.get("userId");
  const taskId = c.req.param("taskId");
  const link = (await listTaskLinks(c.env.DB, userId, taskId)).find(
    (l) => l.provider === "google-calendar",
  );
  if (!link) return fail(c, 404, "Tarefa não está no Google Agenda");
  const ctx = await loadCtx(c.env, userId, "google-calendar");
  if (!ctx) return fail(c, 409, RECONNECT, { code: INTEGRATION_ERROR.reconnect });
  try {
    await pushLink(
      c.env,
      ctx,
      { ...link, timeZone },
      null,
      await getTask(c.env.DB, userId, taskId),
    );
  } catch (err) {
    if (err instanceof InvalidGrantError)
      return fail(c, 409, RECONNECT, { code: INTEGRATION_ERROR.reconnect });
    console.error(`Falha ao sincronizar ${taskId}`, err);
    return fail(c, 502, "O Google Agenda não respondeu; tente de novo");
  }
  return c.json({ task: await getTask(c.env.DB, userId, taskId) });
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
