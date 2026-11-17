import type { MiddlewareHandler } from "hono";
import { auth } from "../auth";
import { fail } from "../lib/errors";
import { roleOf } from "../lib/user";

/**
 * Cookie (web) ou `Authorization: Bearer` (app, plugin `bearer`): o mesmo `getSession` lê os dois.
 * `plan` vem do `cookieCache` na web: até 5 min atrás do D1 depois de uma troca de plano.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return fail(c, 401, "Unauthorized");
  c.set("userId", session.user.id);
  c.set("plan", roleOf(session.user.plan));
  await next();
};
