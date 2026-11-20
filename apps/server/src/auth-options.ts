import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { GenericEndpointContext } from "better-auth";
import { bearer, captcha, magicLink, oneTimeToken } from "better-auth/plugins";
import type { Env } from "./index";
import { allowedOrigins, NATIVE_ORIGINS } from "./lib/origin";
import { sha256b64url } from "./lib/encoding";
import { sendEmail } from "./lib/email";
import { magicLinkEmail } from "./lib/email/templates/magic-link";
import { cancelSubscriptionsOf, stripeClient } from "./lib/stripe";
import { revokeAll } from "./integrations/connection";
import {
  claimMagicLinkSend,
  deleteUserData,
  dropUsedMagicLinkChallenge,
  forgetEmail,
  getMagicLinkChallenge,
  releaseMagicLinkSend,
  saveMagicLinkChallenge,
} from "./db/user";

const LINK_TTL_S = 600;
export const EMAIL_COOLDOWN_MS = 60_000;
const VERIFY = "/magic-link/verify";

/** `next` do link web: só path+search, e só se o callbackURL for da própria WEB_URL. */
function nextOf(url: string, web: string): string {
  const callback = new URL(url).searchParams.get("callbackURL");
  if (!callback) return "";
  const target = new URL(callback, web);
  const next = target.pathname + target.search;
  return target.origin === web && next !== "/" ? `&next=${encodeURIComponent(next)}` : "";
}

async function sendMagicLink(
  env: Env,
  data: { email: string; url: string; token: string; metadata?: Record<string, unknown> },
  ctx: GenericEndpointContext | undefined,
): Promise<void> {
  const challenge = data.metadata?.challenge;
  const email = data.email.toLowerCase();
  const sentAt = Date.now();
  if (!(await claimMagicLinkSend(env.DB, email, sentAt, EMAIL_COOLDOWN_MS))) return;

  // O link nunca é o GET de verify: scanner de e-mail (Safe Links) abriria e queimaria o token.
  const web = allowedOrigins(env)[0];
  let url = `${web}/verify#token=${data.token}${nextOf(data.url, web)}`;
  if (typeof challenge === "string") {
    const hash = await sha256b64url(data.token);
    await saveMagicLinkChallenge(env.DB, hash, challenge, sentAt, sentAt + LINK_TTL_S * 1000);
    url = `${web}/auth/app?token=${data.token}`;
  }

  const send = sendEmail(env, { to: data.email, ...magicLinkEmail(url, LINK_TTL_S / 60) }).catch(
    async (err) => {
      await releaseMagicLinkSend(env.DB, email, sentAt);
      throw err;
    },
  );
  await (ctx ? ctx.context.runInBackgroundOrAwait(send) : send);
}

const isChallenge = (v: unknown) => typeof v === "string" && /^[\w-]{43}$/.test(v);

/**
 * Link pedido pelo app só vale com o `verifier` cujo S256 é o `challenge` do pedido — quem só tem
 * o e-mail não entra. Lança antes do endpoint, então o token não é consumido (e challenge
 * malformado no pedido nem chega a criar token).
 */
const requireVerifier = (db: D1Database) =>
  createAuthMiddleware(async (ctx) => {
    const challenge: unknown = ctx.body?.metadata?.challenge;
    if (ctx.path === "/sign-in/magic-link" && challenge !== undefined && !isChallenge(challenge))
      throw new APIError("BAD_REQUEST", { message: "invalid challenge" });
    if (ctx.path !== VERIFY || typeof ctx.query?.token !== "string") return;
    const stored = await getMagicLinkChallenge(db, await sha256b64url(ctx.query.token));
    if (!stored) return;
    const verifier = ctx.headers?.get("x-mewki-verifier");
    if (!verifier || (await sha256b64url(verifier)) !== stored)
      throw new APIError("FORBIDDEN", { message: "invalid verifier" });
  });

const dropChallenge = (db: D1Database) =>
  createAuthMiddleware(async (ctx) => {
    if (ctx.path !== VERIFY || typeof ctx.query?.token !== "string") return;
    await dropUsedMagicLinkChallenge(db, await sha256b64url(ctx.query.token));
  });

/** Pura (sem `cloudflare:workers`): a CLI do schema e os testes montam a instância a partir dela. */
export function authOptions(env: Env, background?: (promise: Promise<unknown>) => void) {
  return {
    basePath: "/auth",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins: [...allowedOrigins(env), ...NATIVE_ORIGINS],
    socialProviders: {
      google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
    },
    account: { accountLinking: { trustedProviders: ["google"] } },
    user: {
      additionalFields: {
        plan: { type: "string", required: false, input: false },
        stripeCustomerId: { type: "string", required: false, input: false, returned: false },
      },
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          // A cobrança some junto com a conta: o cartão não pode seguir sendo debitado.
          if (env.STRIPE_SECRET_KEY) {
            try {
              await cancelSubscriptionsOf(stripeClient(env), user.id);
            } catch (err) {
              // Não segura a exclusão (a /privacidade promete); assinatura órfã fica no log.
              console.error(`Falha ao cancelar assinatura de ${user.id}`, err);
            }
          }
          // Antes do wipe: depois dele não sobra token pra revogar. Best-effort (não lança).
          await revokeAll(env, user.id);
        },
        afterDelete: async (user) => {
          await deleteUserData(env.DB, user.id);
          await forgetEmail(env.DB, user.email);
        },
      },
    },
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    // O embutido guarda em memória por isolate, inútil no Worker: o limite é o `AUTH_LIMITER`.
    rateLimit: { enabled: false },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      database: { validateSchema: false },
      ...(background && { backgroundTasks: { handler: background } }),
    },
    hooks: { before: requireVerifier(env.DB), after: dropChallenge(env.DB) },
    plugins: [
      bearer(),
      magicLink({
        expiresIn: LINK_TTL_S,
        storeToken: "hashed",
        sendMagicLink: (data, ctx) => sendMagicLink(env, data, ctx),
      }),
      captcha({
        provider: "cloudflare-turnstile",
        secretKey: env.TURNSTILE_SECRET_KEY,
        endpoints: ["/sign-in/magic-link"],
      }),
      oneTimeToken(),
    ],
  } satisfies BetterAuthOptions;
}
