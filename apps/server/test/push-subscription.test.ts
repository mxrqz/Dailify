import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";

import { env } from "cloudflare:workers";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { countSubscriptions } from "../src/db/push";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

let userId = "";
beforeEach(() => {
  userId = `ps-${crypto.randomUUID()}`;
  mockSession(() => ({ id: userId }));
});

// The receiver keys of the RFC 8291 §5 vector: a real P-256 point and a 16-byte secret.
const VALID = {
  endpoint: "https://push.example.com/send/abc",
  p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  timezone: "America/Sao_Paulo",
};

const subscribe = (body: object) =>
  app.request(
    "/push/subscription",
    { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } },
    env,
  );

describe("POST /push/subscription — keys", () => {
  it("stores a subscription with valid keys", async () => {
    expect((await subscribe(VALID)).status).toBe(204);
    expect(await countSubscriptions(env.DB, userId)).toBe(1);
  });

  it.each([
    ["p256dh not base64url", { p256dh: "not a key!" }],
    ["p256dh of the wrong length", { p256dh: VALID.p256dh.slice(0, 40) }],
    ["p256dh off the curve", { p256dh: "B" + "A".repeat(86) }],
    ["auth of the wrong length", { auth: "BTBZMqHH6r4T" }],
    ["auth missing", { auth: undefined }],
  ])("400s on %s and stores nothing", async (_, patch) => {
    const res = await subscribe({ ...VALID, ...patch });
    expect(res.status).toBe(400);
    expect(await countSubscriptions(env.DB, userId)).toBe(0);
  });
});
