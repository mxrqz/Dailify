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
  type Role,
} from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { fail } from "../lib/errors";
import { appOrigin } from "../lib/origin";
import { bytesToBase64url } from "../lib/push";
import {
  consumeState,
  deleteConnection,
  getConnection,
  insertState,
  keepDuplicate,
  listConnections,
  listDuplicates,
  listReadonly,
  listStale,
  listTaskLinks,
  mergeDuplicate,
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
import { createEvent, replaceMeet } from "../integrations/google-calendar";
import { syncCalendar } from "../integrations/google-calendar/sync";
import { ActionError, type Ctx as ProviderCtx } from "../integrations/types";

type Ctx = Context<{ Bindings: Env; Variables: { userId: string; plan: Role } }>;

const STATE_TTL = 10 * 60 * 1000;

const integrations = new Hono<{ Bindings: Env; Variables: { userId: string; plan: Role } }>();
integrations.use("/integrations", requireAuth, rateLimit("API_LIMITER"));
integrations.use("/integrations/*", requireAuth, rateLimit("API_LIMITER"));

// O Google volta pro SPA, que manda {code, state} com a sessão: é isso que amarra a conta
// externa a quem está logado (redirect direto pro worker não tem como saber quem é).
const redirectUri = (c: Ctx, id: ProviderId) =>
  `${appOrigin(c.env, c.req.header("origin"))}/integrations/${id}/callback`;

function statusOf(
  env: Env,
  id: ProviderId,
  allowed: boolean,
  row?: ConnectionRow | null,
  flags: Pick<IntegrationStatus, "stale" | "duplicates" | "readonly"> = {},
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
    ...(flags.stale?.length && { stale: flags.stale }),
    ...(flags.duplicates?.length && { duplicates: flags.duplicates }),
    ...(flags.readonly?.length && { readonly: flags.readonly }),
    ...(row.skipped > 0 && { skipped: row.skipped }),
  };
}

integrations.get("/integrations", async (c) => {
  const userId = c.get("userId");
  const role = c.get("plan");
  const [rows, stale, duplicates, readonly] = await Promise.all([
    listConnections(c.env.DB, userId),
    listStale(c.env.DB, userId),
    listDuplicates(c.env.DB, userId),
    listReadonly(c.env.DB, userId),
  ]);
  return c.json(
    PROVIDER_IDS.map((id) =>
      statusOf(
        c.env,
        id,
        canUseIntegration(role, id),
        rows.find((r) => r.provider === id),
        {
          stale: stale.filter((s) => s.provider === id).map((s) => s.task_id),
          duplicates: duplicates
            .filter((d) => d.provider === id)
            .map((d) => ({ taskId: d.duplicate_of, importedId: d.task_id })),
          readonly: readonly.filter((r) => r.provider === id).map((r) => r.task_id),
        },
      ),
    ),
  );
});

integrations.post("/integrations/:provider/connect", async (c) => {
  const id = c.req.param("provider");
  if (!isProviderId(id)) return fail(c, 404, "Integração desconhecida");
  const userId = c.get("userId");
  if (!canUseIntegration(c.get("plan"), id))
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
  const role = c.get("plan");
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
  // O import inicial entra na resposta: o web recarrega os meses com as tarefas novas. Falhar aqui
  // não desfaz a conexão — o cron e o próximo GET /tasks tentam de novo.
  let imported = 0;
  try {
    ({ imported } = await syncCalendar(c.env, userId));
  } catch (err) {
    console.error(`Falha no import inicial de ${id}`, err);
  }
  return c.json({
    ...statusOf(c.env, id, true, await getConnection(c.env.DB, userId, id)),
    imported,
  });
});

const RECONNECT = "Reconecte a Agenda para continuar";

/** Plano + conexão ativa + os erros esperados do Google, iguais em toda rota que fala com ele. */
async function withCalendar(c: Ctx, run: (ctx: ProviderCtx) => Promise<unknown>) {
  const userId = c.get("userId");
  if (!canUseIntegration(c.get("plan"), "google-calendar"))
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

integrations.post("/integrations/google-calendar/events", async (c) => {
  const parsed = createEvent.parse(await c.req.json().catch(() => null));
  if ("error" in parsed) return fail(c, 400, parsed.error);
  return withCalendar(c, (ctx) => createEvent.run(ctx, parsed.input));
});

// "Gerar novo Meet": trocar ou tirar o Meet é edição da tarefa (links) e vai na propagação.
integrations.post("/integrations/google-calendar/events/:taskId/meet", (c) =>
  withCalendar(c, (ctx) => replaceMeet(ctx, c.req.param("taskId"))),
);

// O par da duplicata (`duplicates` do GET): "merge" junta na tarefa própria, "keep" mantém as duas.
// Só D1, nada no Google — por isso sem gate de plano nem conexão, como o desconectar.
integrations.post("/integrations/google-calendar/duplicates/:importedId", async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const action = typeof body === "object" && body !== null ? Reflect.get(body, "action") : null;
  if (action !== "merge" && action !== "keep") return fail(c, 400, "action inválida");
  const userId = c.get("userId");
  const importedId = c.req.param("importedId");
  if (action === "keep")
    return (await keepDuplicate(c.env.DB, userId, "google-calendar", importedId))
      ? c.body(null, 204)
      : fail(c, 404, "Duplicata não encontrada");
  const task = await mergeDuplicate(c.env.DB, userId, "google-calendar", importedId);
  if (!task) return fail(c, 404, "Duplicata não encontrada");
  return c.json({ task, removedId: importedId });
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
  if (!link) return fail(c, 404, "Tarefa não está na Agenda");
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
    return fail(c, 502, "A Agenda não respondeu; tente de novo");
  }
  return c.json({ task: await getTask(c.env.DB, userId, taskId) });
});

// Sem gate de plano: quem perdeu o plano ainda precisa conseguir desconectar. As tarefas ficam,
// inclusive as importadas: só os vínculos (e o syncToken, com a conexão) saem.
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
