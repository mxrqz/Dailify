import { Hono } from "hono";
import { isRecord } from "@dailify/shared";
import type { AppEnv } from "../index";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rate-limit";
import { deleteSubscription, saveSubscription, countSubscriptions } from "../db/push";
import { fail } from "../lib/errors";
import { base64urlToBytes } from "../lib/encoding";
import { readJson, validZone } from "../lib/task-input";

const push = new Hono<AppEnv>();
push.use("/push/subscription", requireAuth, rateLimit("API_LIMITER"));

const MAX_ENDPOINT_LEN = 1024;

function decode(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  try {
    return base64urlToBytes(value);
  } catch {
    return null;
  }
}

/** RFC 8291 keys: `p256dh` an uncompressed P-256 point, `auth` 16 bytes. A bad one fails every send. */
async function validPushKeys(p256dh: unknown, auth: unknown): Promise<boolean> {
  const point = decode(p256dh);
  if (decode(auth)?.length !== 16 || point?.length !== 65) return false;
  try {
    await crypto.subtle.importKey("raw", point, { name: "ECDH", namedCurve: "P-256" }, false, []);
    return true;
  } catch {
    return false; // 65 bytes, but not a point on the curve
  }
}

/** A chave pública VAPID não é segredo — o browser precisa dela para se inscrever. */
push.get("/push/key", (c) =>
  c.env.VAPID_PUBLIC_KEY
    ? c.json({ key: c.env.VAPID_PUBLIC_KEY })
    : fail(c, 503, "Push não configurado"),
);

push.get("/push/subscription", async (c) =>
  c.json({ count: await countSubscriptions(c.env.DB, c.get("userId")) }),
);

push.post("/push/subscription", async (c) => {
  const body = await readJson(c);
  if (!isRecord(body)) return fail(c, 400, "invalid body");

  const { endpoint, p256dh, auth } = body;
  const timezone = validZone(body.timezone);

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
  if (
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    !(await validPushKeys(p256dh, auth))
  )
    return fail(c, 400, "invalid keys");
  if (!timezone) return fail(c, 400, "invalid timezone");

  await saveSubscription(c.env.DB, c.get("userId"), { endpoint, p256dh, auth, timezone });
  return c.body(null, 204);
});

push.delete("/push/subscription", async (c) => {
  const body = await readJson(c);
  const endpoint = isRecord(body) ? body.endpoint : undefined;
  if (typeof endpoint !== "string") return fail(c, 400, "invalid endpoint");

  await deleteSubscription(c.env.DB, c.get("userId"), endpoint);
  return c.body(null, 204);
});

export default push;
