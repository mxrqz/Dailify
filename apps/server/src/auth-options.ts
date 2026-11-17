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
 * Um e-mail por endereço por minuto, contado só nos que saíram (o plugin cria o token antes de
 * chamar a gente). Reserva atômica: quem perde a corrida não manda; a resposta não muda.
 */
async function claimSend(db: D1Database, email: string, now: number): Promise<boolean> {
  const row = await db
    .prepare(
      `INSERT INTO magic_link_sent (email, sent_at) VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET sent_at=excluded.sent_at WHERE sent_at<=?
       RETURNING 1 AS ok`,
    )
    .bind(email, now, now - EMAIL_COOLDOWN_MS)
    .first();
  return row !== null;
}

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
  if (!(await claimSend(env.DB, email, sentAt))) return;

  // O link nunca é o GET de verify: scanner de e-mail (Safe Links) abriria e queimaria o token.
  const web = allowedOrigins(env)[0];
  let url = `${web}/verify#token=${data.token}${nextOf(data.url, web)}`;
  if (typeof challenge === "string") {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM magic_link_challenge WHERE expires_at<?`).bind(sentAt),
      env.DB.prepare(
        `INSERT INTO magic_link_challenge (token_hash, challenge, expires_at) VALUES (?, ?, ?)`,
      ).bind(await challengeOf(data.token), challenge, sentAt + LINK_TTL_S * 1000),
    ]);
    url = `${web}/auth/app?token=${data.token}`;
  }

  // Envio que falhou devolve a vaga: senão a pessoa espera um minuto por um e-mail que não saiu.
  const send = sendEmail(env, { to: data.email, ...magicLinkEmail(url) }).catch(async (err) => {
    await env.DB.prepare(`DELETE FROM magic_link_sent WHERE email=? AND sent_at=?`)
      .bind(email, sentAt)
      .run();
    throw err;
  });
  await (ctx ? ctx.context.runInBackgroundOrAwait(send) : send);
}

/**
 * Conta apagada não deixa o e-mail para trás: links pendentes (e seus challenges), a vaga do
 * limite e, de carona, os `verification` vencidos de todo mundo.
 */
async function forgetEmail(db: D1Database, email: string): Promise<void> {
  const mine = `identifier LIKE 'magic-link:%' AND CASE WHEN json_valid(value)
    THEN lower(json_extract(value, '$.email')) END = ?`;
  const lower = email.toLowerCase();
  await db.batch([
    db
      .prepare(
        `DELETE FROM magic_link_challenge WHERE token_hash IN
         (SELECT substr(identifier, 12) FROM verification WHERE ${mine})`,
      )
      .bind(lower),
    db
      .prepare(`DELETE FROM verification WHERE ${mine} OR expiresAt<?`)
      .bind(lower, new Date().toISOString()),
    db.prepare(`DELETE FROM magic_link_sent WHERE email=?`).bind(lower),
  ]);
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
