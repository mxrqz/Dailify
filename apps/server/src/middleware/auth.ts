import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { auth, mcpUserId } from "../auth";
import { fail } from "../lib/errors";
import { planOf } from "../db/user";

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
/** Only `/tasks`: a token bound to the `/mcp` audience must not open billing, settings or the AI. */
export const requireTaskAuth = authenticate(true);
