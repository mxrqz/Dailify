import { Hono } from "hono";
import type { Env } from "../index";
import { deleteUserData } from "../db/tasks";
import { cancelSubscriptionsOf, stripeClient } from "../lib/stripe";
import { verifySvix } from "../lib/svix";
import { fail } from "../lib/errors";

const clerkWebhook = new Hono<{ Bindings: Env }>();

function eventOf(body: string): { type?: string; userId?: string } {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return {};
    const type = Reflect.get(parsed, "type");
    const data = Reflect.get(parsed, "data");
    const id = typeof data === "object" && data !== null ? Reflect.get(data, "id") : undefined;
    return { type: typeof type === "string" ? type : undefined, userId: typeof id === "string" ? id : undefined };
  } catch {
    return {};
  }
}

/**
 * Conta apagada no Clerk (pelo app ou pelo painel) tem que levar os dados junto — sem isto as
 * tarefas ficam no D1 para sempre, contra o que a /privacidade promete.
 */
clerkWebhook.post("/webhooks/clerk", async (c) => {
  if (!c.env.CLERK_WEBHOOK_SECRET) return fail(c, 503, "Webhook não configurado");

  const body = await c.req.text();
  const valid = await verifySvix(c.env.CLERK_WEBHOOK_SECRET, {
    id: c.req.header("svix-id"),
    timestamp: c.req.header("svix-timestamp"),
    signature: c.req.header("svix-signature"),
  }, body);
  if (!valid) return fail(c, 400, "Invalid signature");

  const { type, userId } = eventOf(body);
  if (type === "user.deleted" && userId) {
    // A cobrança some junto com a conta: sem isto o cartão continua sendo debitado por uma
    // assinatura que ninguém mais consegue nem achar (o customer id morreu com o usuário).
    if (c.env.STRIPE_SECRET_KEY) {
      try {
        await cancelSubscriptionsOf(stripeClient(c.env), userId);
      } catch (err) {
        // Falhar aqui não pode segurar a exclusão dos dados — essa é a parte que o usuário pediu
        // e que a /privacidade promete. Assinatura órfã fica no log para ser tratada à mão.
        console.error(`Falha ao cancelar assinatura de ${userId}`, err);
      }
    }
    await deleteUserData(c.env.DB, userId);
  }

  return c.body(null, 200);
});

export default clerkWebhook;
