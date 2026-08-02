import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import type { MiddlewareHandler } from "hono";
import { fail } from "../lib/errors";

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const auth = getAuth(c);
  if (!auth?.userId) return fail(c, 401, "Unauthorized");
  c.set("userId", auth.userId);
  await next();
};

export { clerkMiddleware };
