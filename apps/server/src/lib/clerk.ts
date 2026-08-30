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

export interface BillingDetails {
  nextPaymentDate: string;
  cardBrand?: string;
  cardLast4?: string;
  expMonth?: number;
  expYear?: number;
  walletType?: string;
  nextAmount?: number;
  recurring: "year" | "month";
  currency: string;
  paymentMethodType?: string;
}

/**
 * Conta apagada não tem metadata para atualizar — e um throw aqui viraria 500 no webhook do
 * Stripe, que então retenta e acaba desabilitando o endpoint. Um usuário deletado derrubava a
 * atualização de plano de todos os outros.
 */
async function updateMetadata(
  env: Env,
  clerkUserId: string,
  metadata: Parameters<ReturnType<typeof clerk>["users"]["updateUserMetadata"]>[1],
): Promise<void> {
  try {
    await clerk(env).users.updateUserMetadata(clerkUserId, metadata);
  } catch (err) {
    if (!isMissingUser(err)) throw err;
    console.warn(`Clerk user ${clerkUserId} não existe mais; metadata ignorada`);
  }
}

function isMissingUser(err: unknown): boolean {
  return typeof err === "object" && err !== null && Reflect.get(err, "status") === 404;
}

export async function updateUserRole(
  env: Env,
  params: { clerkUserId: string; role: Role; stripeCustomerId: string | undefined },
): Promise<void> {
  await updateMetadata(env, params.clerkUserId, {
    privateMetadata: {
      plan: params.role,
      stripeCustomerId: params.stripeCustomerId,
      subscriptionActive: params.role !== "free",
      lastPayment: new Date().toISOString(),
    },
    publicMetadata: { plan: params.role },
  });
}

export async function updateUserBillingDetails(
  env: Env,
  clerkUserId: string,
  billing: BillingDetails,
): Promise<void> {
  await updateMetadata(env, clerkUserId, { privateMetadata: { ...billing } });
}
