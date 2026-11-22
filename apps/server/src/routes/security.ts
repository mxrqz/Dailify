import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { isRecord } from "@dailify/shared";
import { isAPIError } from "better-auth/api";
import type { AppEnv } from "../index";
import { auth } from "../auth";
import { mailLater, rejectPwned, rowsFor } from "../auth-security";
import { requireAuth, requireRecentMfa } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { fail } from "../lib/errors";
import { readJson } from "../lib/task-input";
import { securityChanged } from "../lib/email/templates/emails";
import { billingProfile } from "../db/user";

const security = new Hono<AppEnv>();
security.use("*", requireAuth);
security.use("*", rateLimit("API_LIMITER"));

/**
 * A first password for an account that signs in by link, code or Google. Better Auth's
 * `setPassword` is server-only, so this route is its door: step-up, the breach check, then the
 * other sessions end, as the e-mail says. Changing an existing one is `/auth/change-password`.
 */
security.post("/password", requireRecentMfa, async (c) => {
  const body = await readJson(c);
  const newPassword = isRecord(body) ? body.newPassword : undefined;
  if (typeof newPassword !== "string") return fail(c, 400, "newPassword required");
  const headers = c.req.raw.headers;
  try {
    await rejectPwned(newPassword);
    await auth.api.setPassword({ body: { newPassword }, headers });
    await auth.api.revokeOtherSessions({ headers });
  } catch (err) {
    if (!isAPIError(err)) throw err;
    const code: unknown = err.body?.code;
    return fail(c, statusOf(err.statusCode), err.message, typeof code === "string" ? { code } : {});
  }
  const userId = c.get("userId");
  const { email } = await billingProfile(c.env.DB, userId);
  if (email)
    c.executionCtx.waitUntil(
      mailLater(
        undefined,
        async () => ({
          to: email,
          mail: securityChanged(
            "password",
            await rowsFor(c.env, userId, headers.get("user-agent")),
          ),
        }),
        c.env,
      ),
    );
  return c.body(null, 204);
});

const statusOf = (n: number): ContentfulStatusCode =>
  n === 400 || n === 401 || n === 403 || n === 503 ? n : 400;

export default security;
