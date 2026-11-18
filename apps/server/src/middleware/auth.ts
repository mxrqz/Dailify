import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../index";
import { auth } from "../auth";
import { fail } from "../lib/errors";
import { roleOf } from "../lib/user";

/**
 * Cookie (web) ou `Authorization: Bearer` (app, plugin `bearer`): o mesmo `getSession` lê os dois.
 * `plan` vem do D1, não da sessão: o `cookieCache` (5 min) ainda teria o plano de antes do checkout.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return fail(c, 401, "Unauthorized");
  const row = await c.env.DB.prepare(`SELECT plan FROM "user" WHERE id=?`)
    .bind(session.user.id)
    .first<{ plan: string | null }>();
  c.set("userId", session.user.id);
  c.set("plan", roleOf(row?.plan));
  await next();
};
