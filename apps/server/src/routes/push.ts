import { Hono } from "hono";
import { IANAZone } from "luxon";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { deleteSubscription, saveSubscription, subscriptionsOf } from "../db/push";
import { fail } from "../lib/errors";

const push = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

const MAX_ENDPOINT_LEN = 1024;
const MAX_KEY_LEN = 200;

function field(o: object, k: string): unknown {
  return Reflect.get(o, k);
}

/** A chave pública VAPID não é segredo — o browser precisa dela para se inscrever. */
push.get("/push/key", (c) =>
  c.env.VAPID_PUBLIC_KEY ? c.json({ key: c.env.VAPID_PUBLIC_KEY }) : fail(c, 503, "Push não configurado"),
);

push.get("/push/subscription", requireAuth, async (c) =>
  c.json({ count: await subscriptionsOf(c.env.DB, c.get("userId")) }),
);

push.post("/push/subscription", requireAuth, rateLimit("API_LIMITER"), async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  if (typeof body !== "object" || body === null) return fail(c, 400, "invalid body");

  const endpoint = field(body, "endpoint");
  const p256dh = field(body, "p256dh");
  const auth = field(body, "auth");
  const timezone = field(body, "timezone");

  // Só https: o endpoint vira alvo de fetch do próprio Worker, e um http:// aqui seria o servidor
  // mandando notificação em claro para onde o cliente pedir.
  if (
    typeof endpoint !== "string" ||
    endpoint.length > MAX_ENDPOINT_LEN ||
    !URL.canParse(endpoint) ||
    new URL(endpoint).protocol !== "https:"
  ) {
    return fail(c, 400, "invalid endpoint");
  }
  if (typeof p256dh !== "string" || !p256dh || p256dh.length > MAX_KEY_LEN)
    return fail(c, 400, "invalid p256dh");
  if (typeof auth !== "string" || !auth || auth.length > MAX_KEY_LEN)
    return fail(c, 400, "invalid auth");
  if (typeof timezone !== "string" || !IANAZone.isValidZone(timezone))
    return fail(c, 400, "invalid timezone");

  await saveSubscription(c.env.DB, c.get("userId"), { endpoint, p256dh, auth, timezone });
  return c.body(null, 204);
});

push.delete("/push/subscription", requireAuth, async (c) => {
  const body: unknown = await c.req.json().catch(() => undefined);
  const endpoint = typeof body === "object" && body !== null ? field(body, "endpoint") : undefined;
  if (typeof endpoint !== "string") return fail(c, 400, "invalid endpoint");

  await deleteSubscription(c.env.DB, c.get("userId"), endpoint);
  return c.body(null, 204);
});

export default push;
