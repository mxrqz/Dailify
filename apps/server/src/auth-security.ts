import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { parseSetCookieHeader } from "better-auth/cookies";
import { twoFactor } from "better-auth/plugins";
import { API_ERROR, isRecord, parseUserAgent } from "@dailify/shared";
import type { Env } from "./index";
import { allowedOrigins } from "./lib/origin";
import { isPwned } from "./lib/pwned";
import { sendEmail } from "./lib/email";
import type { Email } from "./lib/email/templates/layout";
import {
  mfaCode,
  newSignIn,
  securityChanged,
  whenAndDevice,
  type SecurityChange,
} from "./lib/email/templates/emails";
import { getSettings } from "./db/settings";
import { markMfa, otherUserAgents } from "./db/user";

/** A sensitive action needs a second factor this recent when MFA is on (`requireRecentMfa`). */
export const STEP_UP_MS = 10 * 60_000;
/** The app's copy of the `two_factor` cookie, which never crosses the webview origin. */
export const TWO_FACTOR_HEADER = "x-mewki-two-factor";
const TWO_FACTOR_COOKIE = "two_factor"; // the plugin's cookie name, not exported by it
const MFA_OTP_MIN = 5;
// A brand-new account's first session isn't a "new device".
const NEW_ACCOUNT_MS = 10 * 60_000;

/**
 * Every path that turns a first factor into a session. The plugin gates only `/sign-in/email`;
 * left alone, a magic link, the e-mailed code or Google would skip the second factor. The one-time
 * token is absent on purpose: it hands the app a browser session that already passed this gate.
 */
export const FIRST_FACTOR = new Set([
  "/sign-in/email",
  "/magic-link/verify",
  "/sign-in/email-otp",
  "/callback/:id",
  "/sign-in/social",
  "/verify-email",
]);
const VERIFY_2FA = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-otp",
  "/two-factor/verify-backup-code",
]);
// Possession plus user verification (`passkey` requires it): both factors, so never gated.
const PASSKEY_SIGN_IN = "/passkey/verify-authentication";
const PASSKEY_CHANGE: Record<string, SecurityChange> = {
  "/passkey/verify-registration": "passkeyAdded",
  "/passkey/delete-passkey": "passkeyRemoved",
};
// Where a new password arrives, and the body key it comes in.
const NEW_PASSWORD: Record<string, string> = {
  "/sign-up/email": "password",
  "/change-password": "newPassword",
  "/reset-password": "newPassword",
};

/** Fails closed: a password Have I Been Pwned can't vouch for is refused. */
export async function rejectPwned(password: string): Promise<void> {
  let pwned: boolean;
  try {
    pwned = await isPwned(password);
  } catch (err) {
    console.error("Password breach check failed", err);
    throw new APIError("SERVICE_UNAVAILABLE", { message: "Password check unavailable" });
  }
  if (pwned)
    throw new APIError("BAD_REQUEST", {
      message: "Password found in a data breach",
      code: API_ERROR.passwordCompromised,
    });
}

/** The "Quando" and "Aparelho" rows, in the user's zone (UTC, labelled, when unset). */
export async function rowsFor(env: Env, userId: string, userAgent: string | null | undefined) {
  const zone = (await getSettings(env.DB, userId)).timeZone ?? "UTC";
  return whenAndDevice(Date.now(), zone, parseUserAgent(userAgent));
}

/** Best-effort: a failed e-mail is logged and never fails the request that caused it. */
export async function mailLater(
  ctx: GenericEndpointContext | undefined,
  build: () => Promise<{ to: string; mail: Email } | null>,
  env: Env,
): Promise<void> {
  const send = build()
    .then((m) => m && sendEmail(env, { to: m.to, ...m.mail }))
    .catch((err: unknown) => console.error("Security e-mail failed", err));
  await (ctx ? ctx.context.runInBackgroundOrAwait(send) : send);
}

const securityMail = (
  env: Env,
  ctx: GenericEndpointContext,
  user: { id: string; email: string },
  kind: SecurityChange,
) =>
  mailLater(
    ctx,
    async () => ({
      to: user.email,
      mail: securityChanged(kind, await rowsFor(env, user.id, ctx.headers?.get("user-agent"))),
    }),
    env,
  );

const family = (ua: string | null | undefined) => {
  const { browser, os, mobile } = parseUserAgent(ua);
  return `${browser}/${os}/${mobile}`;
};

type Fresh = {
  user: { id: string; email: string; createdAt: Date };
  session: { id: string; userAgent?: string | null };
};

/**
 * New device = no other live session of this user has the same browser, system and form factor.
 * ponytail: signing out and back in on the only device also mails; a known-devices table if that
 * annoys anyone.
 */
async function newDeviceMail(env: Env, { user, session }: Fresh) {
  if (Date.now() - new Date(user.createdAt).getTime() < NEW_ACCOUNT_MS) return null;
  const others = await otherUserAgents(env.DB, user.id, session.id);
  if (others.some((ua) => family(ua) === family(session.userAgent))) return null;
  return { to: user.email, mail: newSignIn(await rowsFor(env, user.id, session.userAgent)) };
}

/** `twoFactor`, with its sign-in gate widened from `/sign-in/email` to every `FIRST_FACTOR`. */
export function mfa(env: Env) {
  const plugin = twoFactor({
    issuer: "Mewki",
    // Magic-link and Google accounts have no password to confirm; step-up asks for a code instead.
    allowPasswordless: true,
    otpOptions: {
      period: MFA_OTP_MIN,
      storeOTP: "hashed",
      sendOTP: async ({ user, otp }, ctx) => {
        const rows = await rowsFor(env, user.id, ctx?.headers?.get("user-agent"));
        await sendEmail(env, { to: user.email, ...mfaCode(otp, MFA_OTP_MIN, rows) });
      },
    },
  });
  return {
    ...plugin,
    hooks: {
      after: plugin.hooks.after.map((hook) => ({
        ...hook,
        matcher: (c: { path?: string }) => FIRST_FACTOR.has(c.path ?? ""),
      })),
    },
  };
}

/** Runs after `twoFactor` (plugin order), so it sees whether the gate held the session back. */
export function security(env: Env) {
  return {
    id: "mewki-security",
    hooks: {
      before: [
        {
          // The app sends the pending challenge as a header; Better Auth reads it as the cookie.
          matcher: (c) => Boolean(c.headers?.get(TWO_FACTOR_HEADER)),
          handler: createAuthMiddleware(async (ctx) => {
            const value = ctx.headers?.get(TWO_FACTOR_HEADER) ?? "";
            if (!/^[\w.%~-]{1,512}$/.test(value)) return;
            const headers = new Headers(ctx.headers);
            const name = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE).name;
            headers.set("cookie", `${name}=${value}`);
            return { context: { headers } };
          }),
        },
        {
          matcher: (c) => Object.hasOwn(NEW_PASSWORD, c.path ?? ""),
          handler: createAuthMiddleware(async (ctx) => {
            const password: unknown = ctx.body?.[NEW_PASSWORD[ctx.path]];
            if (typeof password === "string") await rejectPwned(password);
            // A changed password always ends the other sessions, whatever the client asked.
            if (ctx.path === "/change-password")
              return { context: { body: { ...ctx.body, revokeOtherSessions: true } } };
          }),
        },
      ],
      after: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const path = ctx.path;
            const returned: unknown = ctx.context.returned;
            const challenge = ctx.context.createAuthCookie(TWO_FACTOR_COOKIE).name;

            const pending = parseSetCookieHeader(
              ctx.context.responseHeaders?.get("set-cookie") ?? "",
            ).get(challenge);
            if (pending?.value && pending["max-age"] !== 0) {
              // Re-encoded as in the cookie: the parser decoded it, and the app sends it back as one.
              ctx.setHeader(TWO_FACTOR_HEADER, encodeURIComponent(pending.value));
              // Google is a browser navigation: send it to the web's challenge page, not to JSON.
              if (path === "/callback/:id") {
                const web = allowedOrigins(env)[0];
                const target = new URL(ctx.context.responseHeaders?.get("location") ?? "/", web);
                const next = target.origin === web ? target.pathname + target.search : "/";
                throw ctx.redirect(`${web}/two-factor?next=${encodeURIComponent(next)}`);
              }
            }

            const fresh = ctx.context.newSession;
            const verified =
              VERIFY_2FA.has(path) && isRecord(returned) && typeof returned.token === "string";
            // The sign-in branch spends the challenge cookie; step-up and enabling use a session.
            const signIn =
              verified && Boolean(await ctx.getSignedCookie(challenge, ctx.context.secret));
            if (verified) {
              const session = fresh ?? ctx.context.session ?? (await getSessionFromCtx(ctx));
              if (session) await markMfa(env.DB, session.session.id, Date.now());
            }
            if (Object.hasOwn(PASSKEY_CHANGE, path) && !(returned instanceof Error)) {
              const owner = (ctx.context.session ?? (await getSessionFromCtx(ctx)))?.user;
              if (owner) await securityMail(env, ctx, owner, PASSKEY_CHANGE[path]);
            }
            if (!fresh) return;

            const passkey = path === PASSKEY_SIGN_IN;
            if (passkey) await markMfa(env.DB, fresh.session.id, Date.now());
            if (FIRST_FACTOR.has(path) || signIn || passkey)
              await mailLater(ctx, () => newDeviceMail(env, fresh), env);
            // The enabling verify swaps the session; a step-up verify keeps it.
            else if (verified) await securityMail(env, ctx, fresh.user, "mfaOn");
            else if (path === "/two-factor/disable")
              await securityMail(env, ctx, fresh.user, "mfaOff");
            else if (path === "/change-password")
              await securityMail(env, ctx, fresh.user, "password");
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
