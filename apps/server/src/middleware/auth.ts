import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { auth, mcpUserId } from "../auth";
import { fail } from "../lib/errors";
import { API_ERROR } from "@dailify/shared";
import { STEP_UP_MS } from "../auth-security";
import {
  clearStepUpFailures,
  mfaStale,
  planOf,
  recordStepUpFailure,
  stepUpLocked,
} from "../db/user";

/**
 * Cookie (web) ou `Authorization: Bearer` (app, plugin `bearer`): o mesmo `getSession` lê os dois.
 * `plan` vem do D1, não da sessão: o `cookieCache` (5 min) ainda teria o plano de antes do checkout.
 * With `mcp`, an MCP access token also passes: the /mcp tools call the tasks module with it.
 */
const authenticate =
  (mcp: boolean): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const userId =
      session?.user.id ??
      (mcp && c.req.header("authorization") ? await mcpUserId(c.req.raw) : null);
    if (!userId) return fail(c, 401, "Unauthorized");
    c.set("userId", userId);
    // No session behind an MCP token: only `/reminders/token` reads it, and that route stays session-only.
    c.set("sessionId", session?.session.id ?? "");
    c.set("plan", await planOf(c.env.DB, userId));
    await next();
  };

export const requireAuth = authenticate(false);

/** After `requireAuth`: with MFA on, a sensitive action needs a second factor in `STEP_UP_MS`. */
export const requireRecentMfa: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (await mfaStale(c.env.DB, c.get("sessionId"), Date.now() - STEP_UP_MS))
    return fail(c, 403, "Recent second factor required", { code: API_ERROR.mfaRequired });
  await next();
};

/**
 * Step-up codes come with a session, where Better Auth counts no failures: share the sign-in
 * lockout (10 misses, 15 min) so a stolen session can't guess its way past `requireRecentMfa`.
 */
export const stepUpLockout: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return next(); // the sign-in branch: the plugin's own lockout applies
  const userId = session.user.id;
  if (await stepUpLocked(c.env.DB, userId, Date.now()))
    return fail(c, 429, "Too many wrong codes", { code: API_ERROR.rateLimited });
  await next();
  if (c.res.status === 401 || c.res.status === 400)
    await recordStepUpFailure(c.env.DB, userId, Date.now());
  else if (c.res.ok) await clearStepUpFailures(c.env.DB, userId);
};
/** Only `/tasks`: a token bound to the `/mcp` audience must not open billing, settings or the AI. */
export const requireTaskAuth = authenticate(true);
