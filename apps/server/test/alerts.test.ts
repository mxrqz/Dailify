import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// hoisted: o vi.mock abaixo sobe para o topo do módulo e precisa do mock já construído.
const { sendPush } = vi.hoisted(() => ({ sendPush: vi.fn(async () => 201) }));

vi.mock("../src/lib/push", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/push")>();
  return { ...actual, sendPush };
});

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "pushuser" })) };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { dispatchAlerts } from "../src/alerts";
import { insertTask } from "../src/db/tasks";
import { saveSubscription, subscriptionsOf } from "../src/db/push";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  sendPush.mockClear();
  await env.DB.prepare("DELETE FROM tasks").run();
  await env.DB.prepare("DELETE FROM push_subscriptions").run();
});

const subscription = {
  endpoint: "https://push.example.net/x",
  p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  timezone: "America/Sao_Paulo",
};

const task = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  title: "Consulta",
  date: Date.now(),
  duration: "",
  priority: 0,
  repeat: "Off" as const,
  completed: [],
  alert: Date.now() - 60_000,
  ...over,
});

describe("dispatchAlerts", () => {
  it("envia o alerta vencido uma única vez", async () => {
    await insertTask(env.DB, "pushuser", task());
    await saveSubscription(env.DB, "pushuser", subscription);

    expect(await dispatchAlerts(env)).toBe(1);
    expect(sendPush).toHaveBeenCalledOnce();

    // segunda passada do cron: já marcado como enviado
    expect(await dispatchAlerts(env)).toBe(0);
    expect(sendPush).toHaveBeenCalledOnce();
  });

  it("ignora alerta futuro e alerta velho demais", async () => {
    await saveSubscription(env.DB, "pushuser", subscription);
    await insertTask(env.DB, "pushuser", task({ id: "futuro", alert: Date.now() + 60 * 60_000 }));
    await insertTask(
      env.DB,
      "pushuser",
      task({ id: "antigo", alert: Date.now() - 25 * 60 * 60_000 }),
    );

    expect(await dispatchAlerts(env)).toBe(0);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("apaga a inscrição que o push service recusou (410)", async () => {
    sendPush.mockResolvedValueOnce(410);
    await insertTask(env.DB, "pushuser", task());
    await saveSubscription(env.DB, "pushuser", subscription);

    await dispatchAlerts(env);
    expect(await subscriptionsOf(env.DB, "pushuser")).toBe(0);
  });

  it("marca como enviado mesmo sem device inscrito, para não reprocessar para sempre", async () => {
    await insertTask(env.DB, "pushuser", task());

    expect(await dispatchAlerts(env)).toBe(0);
    const row = await env.DB.prepare("SELECT alert_sent FROM tasks WHERE id='a1'").first<{
      alert_sent: number | null;
    }>();
    expect(row?.alert_sent).toBeTruthy();
  });
});

describe("/push/subscription", () => {
  const post = (body: unknown) =>
    app.request(
      "/push/subscription",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      env,
    );

  it("guarda a inscrição do usuário", async () => {
    const res = await post(subscription);
    expect(res.status).toBe(204);
    expect(await subscriptionsOf(env.DB, "pushuser")).toBe(1);
  });

  it("re-inscrever o mesmo endpoint não duplica", async () => {
    await post(subscription);
    await post({ ...subscription, timezone: "Europe/Lisbon" });
    expect(await subscriptionsOf(env.DB, "pushuser")).toBe(1);
  });

  it("recusa endpoint não-https, chave vazia e fuso inválido", async () => {
    expect((await post({ ...subscription, endpoint: "http://x.net/a" })).status).toBe(400);
    expect((await post({ ...subscription, p256dh: "" })).status).toBe(400);
    expect((await post({ ...subscription, timezone: "Marte/Olympus" })).status).toBe(400);
  });

  it("remove a inscrição", async () => {
    await post(subscription);
    const res = await app.request(
      "/push/subscription",
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      },
      env,
    );
    expect(res.status).toBe(204);
    expect(await subscriptionsOf(env.DB, "pushuser")).toBe(0);
  });
});
