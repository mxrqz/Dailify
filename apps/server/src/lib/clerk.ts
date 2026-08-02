import { createClerkClient, type User } from "@clerk/backend";
import type { Role } from "@dailify/shared";
import type { Env } from "../index";

export function clerk(env: Env) {
  return createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
}

export async function getUserRole(env: Env, userId: string): Promise<Role> {
  // Direct lookup — fixes the old server's getUserList().find() bug that broke past 10 users.
  const user = await clerk(env).users.getUser(userId);
  const plan = user.privateMetadata?.plan;
  return plan === "pro" || plan === "pro+ai" || plan === "admin" ? plan : "free";
}

export function userEmail(user: User): string | undefined {
  return user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress;
}

export function readStripeCustomerId(user: User): string | undefined {
  const id = user.privateMetadata?.stripeCustomerId;
  return typeof id === "string" ? id : undefined;
}
