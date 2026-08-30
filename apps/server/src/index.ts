import { Hono } from "hono";
import { cors } from "hono/cors";
import { clerkMiddleware } from "./middleware/auth";
import tasks from "./routes/tasks";
import billing from "./routes/billing";
import voice from "./routes/voice";
import clerkWebhook from "./routes/clerk-webhook";
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

app.onError((err, c) => {
  console.error(err);
  return fail(c, 500, "Internal error");
});

export default app;
