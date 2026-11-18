import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Role } from "@dailify/shared";
import { auth } from "./auth";
import { rateLimit } from "./middleware/rate-limit";
import tasks from "./routes/tasks";
import billing from "./routes/billing";
import voice from "./routes/voice";
import settings from "./routes/settings";
import push from "./routes/push";
import integrations from "./routes/integrations";
import mew from "./routes/mew";
import { dispatchAlerts } from "./alerts";
import { syncOldest } from "./integrations/google-calendar/sync";
import { fail } from "./lib/errors";
import { isAllowedOrigin } from "./lib/origin";

export interface Env {
  DB: D1Database;
  // Opcionais: em teste/dev local o binding de rate limit nao existe (ver middleware/rate-limit.ts).
  API_LIMITER?: RateLimit;
  VOICE_LIMITER?: RateLimit;
  AUTH_LIMITER?: RateLimit;
  ALLOWED_ORIGIN: string; // lista separada por vírgula (lib/origin.ts)
  BETTER_AUTH_SECRET: string; // >= 32 chars; assina cookie e cookieCache
  BETTER_AUTH_URL: string; // origem pública do worker (https://api.mewki.mxrqz.com)
  TURNSTILE_SECRET_KEY: string;
  EMAIL: SendEmail; // binding send_email (lib/email/providers/cloudflare.ts)
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  OPENAI_API_KEY: string;
  // Par VAPID do Web Push (`bun run vapid` gera). A pública é servida em GET /push/key.
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string; // "mailto:..." — quem o push service contata se algo der errado
  STRIPE_PRICE_PRO: string;
  STRIPE_PRICE_PRO_YEAR: string;
  STRIPE_PRICE_MAX: string;
  STRIPE_PRICE_MAX_YEAR: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // Cifra os tokens de integração em repouso (integrations/crypto.ts): base64 de 32 bytes.
  TOKEN_KEY_V1: string;
}

/** Every app and sub-app; `requireAuth` sets `userId` and `plan`. */
export type AppEnv = { Bindings: Env; Variables: { userId: string; plan: Role } };

const app = new Hono<AppEnv>();
app.use(
  "*",
  cors({
    origin: (origin, c) => (isAllowedOrigin(c.env, origin) ? origin : null),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    // Os dois `x-` são do login: captcha do Turnstile e o verifier do magic link do app.
    allowHeaders: ["Authorization", "Content-Type", "x-captcha-response", "x-mewki-verifier"],
    // Cookie de sessão na web; no app o token volta em `set-auth-token` (plugin bearer).
    credentials: true,
    exposeHeaders: ["set-auth-token"],
    // Sem isto cada request autenticado paga um preflight (o Bearer força). Chrome corta em 2h.
    maxAge: 86400,
  }),
);
app.get("/health", (c) => c.json({ ok: true }));

// Só o que manda e-mail ou cria sessão: `get-session` roda a cada foco de aba e não entra.
app.use("/auth/sign-in/*", rateLimit("AUTH_LIMITER"));
app.use("/auth/magic-link/*", rateLimit("AUTH_LIMITER"));
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));
// Order is load-bearing: sub-apps at one prefix share middleware. Voice first, so its handlers end
// the chain and tasks' use("*") (a second requireAuth + API_LIMITER) never runs for /parse, /voice.
app.route("/tasks", voice);
app.route("/tasks", tasks);
app.route("/", billing);
app.route("/", push);
app.route("/", settings);
app.route("/", integrations);
app.route("/mew", mew);

app.notFound((c) => fail(c, 404, "Not found"));
app.onError((err, c) => {
  console.error(err);
  return fail(c, 500, "Internal error");
});

// O Worker precisa de `scheduled` no default export (Cron Trigger em wrangler.toml), e os testes
// precisam do `app` com `.request()` — pendurar um no outro entrega os dois sem uma casca extra.
export default Object.assign(app, {
  scheduled: async (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(dispatchAlerts(env));
    ctx.waitUntil(syncOldest(env));
  },
});
