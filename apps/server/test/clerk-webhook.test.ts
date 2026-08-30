import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { insertTask, getTask } from "../src/db/tasks";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const SECRET = "whsec_dGVzdHNlY3JldA==";

/** Assina como o Svix assinaria — é o que o servidor recalcula para validar. */
async function svixHeaders(body: string, at = Date.now()): Promise<Record<string, string>> {
  const id = "msg_test";
  const timestamp = String(Math.floor(at / 1000));
  const raw = atob(SECRET.slice("whsec_".length));
  const keyBytes = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return { "svix-id": id, "svix-timestamp": timestamp, "svix-signature": `v1,${signature}` };
}

const post = (body: string, headers: Record<string, string>) =>
  app.request("/webhooks/clerk", { method: "POST", headers, body }, env);

describe("POST /webhooks/clerk", () => {
  it("apaga as tarefas do usuário em user.deleted", async () => {
    await insertTask(env.DB, "gone", {
      id: "wh1",
      title: "Some task",
      date: Date.now(),
      duration: "",
      priority: 0,
      repeat: "Off",
      completed: [],
    });
    const body = JSON.stringify({ type: "user.deleted", data: { id: "gone" } });
    const res = await post(body, await svixHeaders(body));

    expect(res.status).toBe(200);
    expect(await getTask(env.DB, "gone", "wh1")).toBeNull();
  });

  it("recusa assinatura inválida sem tocar nos dados", async () => {
    await insertTask(env.DB, "stays", {
      id: "wh2",
      title: "Keep me",
      date: Date.now(),
      duration: "",
      priority: 0,
      repeat: "Off",
      completed: [],
    });
    const body = JSON.stringify({ type: "user.deleted", data: { id: "stays" } });
    const headers = await svixHeaders(body);
    const res = await post(body, { ...headers, "svix-signature": "v1,AAAA" });

    expect(res.status).toBe(400);
    expect(await getTask(env.DB, "stays", "wh2")).not.toBeNull();
  });

  it("recusa assinatura válida porém velha (replay)", async () => {
    const body = JSON.stringify({ type: "user.deleted", data: { id: "old" } });
    const old = Date.now() - 10 * 60 * 1000;
    const res = await post(body, await svixHeaders(body, old));
    expect(res.status).toBe(400);
  });

  it("ignora evento que não é user.deleted", async () => {
    const body = JSON.stringify({ type: "user.updated", data: { id: "gone" } });
    const res = await post(body, await svixHeaders(body));
    expect(res.status).toBe(200);
  });
});
