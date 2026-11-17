import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { GenericEndpointContext } from "better-auth";
import { bearer, captcha, magicLink, oneTimeToken } from "better-auth/plugins";
import type { Env } from "./index";
import { allowedOrigins } from "./lib/origin";
import { challengeOf } from "./integrations/oauth";
import { sendEmail } from "./lib/email";
import { magicLinkEmail } from "./lib/email/templates/magic-link";
import { cancelSubscriptionsOf, stripeClient } from "./lib/stripe";
import { revokeAll } from "./integrations/connection";
import { deleteUserData } from "./db/tasks";

const LINK_TTL_S = 600;
const EMAIL_COOLDOWN_MS = 60_000;
const VERIFY = "/magic-link/verify";
// O app (Tauri) chama de uma origem própria; `mewki://` é o deep link de volta.
const NATIVE_ORIGINS = [
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "mewki://",
];

/**
 * Um e-mail por endereço por minuto. Conta os links do plugin criados no último minuto (o atual
 * incluso); a resposta não muda, então quem martela não descobre nada.
 */
async function recentlySent(db: D1Database, email: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM verification WHERE identifier LIKE 'magic-link:%'
       AND lower(json_extract(value, '$.email'))=lower(?) AND createdAt>?`,
    )
    .bind(email, new Date(Date.now() - EMAIL_COOLDOWN_MS).toISOString())
    .first<{ n: number }>();
  return (row?.n ?? 0) > 1;
}

async function sendMagicLink(
  env: Env,
  data: { email: string; token: string; metadata?: Record<string, unknown> },
  ctx: GenericEndpointContext | undefined,
): Promise<void> {
  const challenge = data.metadata?.challenge;
  if (await recentlySent(env.DB, data.email)) return;

  // O link nunca é o GET de verify: scanner de e-mail (Safe Links) abriria e queimaria o token.
  const web = allowedOrigins(env)[0];
  let url = `${web}/verify#token=${data.token}`;
  if (typeof challenge === "string") {
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM magic_link_challenge WHERE expires_at<?`).bind(now),
      env.DB.prepare(
        `INSERT INTO magic_link_challenge (token_hash, challenge, expires_at) VALUES (?, ?, ?)`,
      ).bind(await challengeOf(data.token), challenge, now + LINK_TTL_S * 1000),
    ]);
    url = `${web}/auth/app?token=${data.token}`;
  }

  const send = sendEmail(env, { to: data.email, ...magicLinkEmail(url) });
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
    const row = await db
      .prepare(`SELECT challenge FROM magic_link_challenge WHERE token_hash=?`)
      .bind(await challengeOf(ctx.query.token))
      .first<{ challenge: string }>();
    if (!row) return;
    const verifier = ctx.headers?.get("x-mewki-verifier");
    if (!verifier || (await challengeOf(verifier)) !== row.challenge)
      throw new APIError("FORBIDDEN", { message: "invalid verifier" });
  });

/** Some só depois que o token foi consumido: se o verify falhou antes, o challenge continua valendo. */
const dropChallenge = (db: D1Database) =>
  createAuthMiddleware(async (ctx) => {
    if (ctx.path !== VERIFY || typeof ctx.query?.token !== "string") return;
    const hash = await challengeOf(ctx.query.token);
    await db
      .prepare(
        `DELETE FROM magic_link_challenge WHERE token_hash=?
         AND NOT EXISTS (SELECT 1 FROM verification WHERE identifier='magic-link:' || ?)`,
      )
      .bind(hash, hash)
      .run();
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
        afterDelete: async (user) => deleteUserData(env.DB, user.id),
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
