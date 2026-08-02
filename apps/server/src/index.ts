import { Hono } from "hono";
import { cors } from "hono/cors";
import { clerkMiddleware } from "./middleware/auth";
import tasks from "./routes/tasks";
import billing from "./routes/billing";

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
app.route("/tasks", tasks);
app.route("/", billing);

export default app;
