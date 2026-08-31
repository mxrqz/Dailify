import { Hono } from "hono";
import { cors } from "hono/cors";
import { clerkMiddleware } from "./middleware/auth";
import tasks from "./routes/tasks";
import billing from "./routes/billing";
import voice from "./routes/voice";
import clerkWebhook from "./routes/clerk-webhook";
import push from "./routes/push";
import { dispatchAlerts } from "./alerts";
import { fail } from "./lib/errors";

export interface Env {
  DB: D1Database;
  // Opcionais: em teste/dev local o binding de rate limit nao existe (ver middleware/rate-limit.ts).
  API_LIMITER?: RateLimit;
  VOICE_LIMITER?: RateLimit;
  ALLOWED_ORIGIN: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_WEBHOOK_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  OPENAI_API_KEY: string;
  // Par VAPID do Web Push (`bun run vapid` gera). A pública é servida em GET /push/key.
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string; // "mailto:..." — quem o push service contata se algo der errado
  STRIPE_PRICE_PRO: string;
  STRIPE_PRICE_PRO_YEAR: string;
  STRIPE_PRICE_PROAI: string;
  STRIPE_PRICE_PROAI_YEAR: string;
}

const app = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
app.use("*", (c, next) =>
  cors({ origin: c.env.ALLOWED_ORIGIN, allowMethods: ["GET", "POST", "PATCH", "DELETE"] })(c, next),
);
app.get("/health", (c) => c.json({ ok: true }));

app.use("*", clerkMiddleware());
app.route("/tasks", tasks);
app.route("/tasks", voice);
app.route("/", billing);
app.route("/", clerkWebhook);
app.route("/", push);

app.onError((err, c) => {
  console.error(err);
  return fail(c, 500, "Internal error");
});

// O Worker precisa de `scheduled` no default export (Cron Trigger em wrangler.toml), e os testes
// precisam do `app` com `.request()` — pendurar um no outro entrega os dois sem uma casca extra.
export default Object.assign(app, {
  scheduled: async (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => {
    ctx.waitUntil(dispatchAlerts(env));
  },
});
