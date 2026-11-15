import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

const { stripeMock } = vi.hoisted(() => ({
  stripeMock: {
    subscriptions: { search: vi.fn(), cancel: vi.fn() },
  },
}));

vi.mock("stripe", () => {
  function MockStripe() {
    return stripeMock;
  }
  MockStripe.createFetchHttpClient = () => ({});
  return { default: MockStripe };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { insertTask, getTask } from "../src/db/tasks";
import { bumpStoredUsage, readStoredUsage } from "../src/db/usage";
import { insertState, upsertConnection } from "../src/db/integrations";
import { sealTokens } from "../src/integrations/connection";

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
  beforeEach(() => {
    vi.clearAllMocks();
    stripeMock.subscriptions.search.mockResolvedValue({ data: [] });
  });

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

  it("cancela a assinatura ativa do usuário apagado", async () => {
    stripeMock.subscriptions.search.mockResolvedValue({
      data: [
        { id: "sub_1", status: "active" },
        { id: "sub_2", status: "canceled" }, // já cancelada: não tocar
      ],
    });
    const body = JSON.stringify({ type: "user.deleted", data: { id: "payer" } });
    const res = await post(body, await svixHeaders(body));

    expect(res.status).toBe(200);
    expect(stripeMock.subscriptions.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: "metadata['clerkUserId']:'payer'" }),
    );
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledOnce();
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith("sub_1");
  });

  // A exclusão dos dados é obrigação nossa; o Stripe fora do ar não pode segurá-la.
  it("apaga os dados mesmo se o cancelamento falhar", async () => {
    stripeMock.subscriptions.search.mockRejectedValue(new Error("stripe down"));
    await insertTask(env.DB, "unlucky", {
      id: "wh3",
      title: "Some task",
      date: Date.now(),
      duration: "",
      priority: 0,
      repeat: "Off",
      completed: [],
    });
    const body = JSON.stringify({ type: "user.deleted", data: { id: "unlucky" } });
    const res = await post(body, await svixHeaders(body));

    expect(res.status).toBe(200);
    expect(await getTask(env.DB, "unlucky", "wh3")).toBeNull();
  });

  it("revoga as integrações e apaga elas, os states e o usage", async () => {
    const revoked: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      revoked.push(new URLSearchParams(String(init?.body)).get("token") ?? "");
      return new Response(null, { status: 200 });
    });
    const now = Date.now();
    const tokens = await sealTokens(env, "wiped", "google-calendar", {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: now + 3600_000,
      scope: "",
    });
    await upsertConnection(
      env.DB,
      "wiped",
      "google-calendar",
      { accountId: "g1", email: null, scopes: "", tokens },
      now,
    );
    await env.DB.prepare(
      `INSERT INTO integration_links (user_id, provider, task_id, external_id, updated_at)
       VALUES ('wiped', 'google-calendar', 't', 'e', 0)`,
    ).run();
    const state = { user_id: "wiped", provider: "google-calendar", code_verifier: "v" };
    await insertState(env.DB, "st-wiped", state, now + 60_000, now);
    await bumpStoredUsage(env.DB, "wiped", "ai", "2026-11");

    const body = JSON.stringify({ type: "user.deleted", data: { id: "wiped" } });
    const res = await post(body, await svixHeaders(body));
    vi.restoreAllMocks();

    expect(res.status).toBe(200);
    expect(revoked).toEqual(["r"]);
    expect(await readStoredUsage(env.DB, "wiped", "ai", "2026-11")).toBe(0);
    for (const table of ["integration_connections", "integration_links", "oauth_states"]) {
      const { results } = await env.DB.prepare(
        `SELECT 1 FROM ${table} WHERE user_id='wiped'`,
      ).all();
      expect(results, table).toHaveLength(0);
    }
  });
});
