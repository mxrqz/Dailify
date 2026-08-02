import { Hono } from "hono";
import { cors } from "hono/cors";
import { clerkMiddleware, requireAuth } from "./middleware/auth";

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
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
// Placeholder — replaced with real handler in Task 3.1. Exists so the 401 path is exercised.
app.get("/tasks", requireAuth, (c) => c.json({ tasks: [] }));

export default app;
