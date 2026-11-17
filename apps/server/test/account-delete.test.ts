import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { stripeMock, sendEmail } = vi.hoisted(() => ({
  stripeMock: { subscriptions: { search: vi.fn(), cancel: vi.fn() } },
  sendEmail: vi.fn<(env: unknown, mail: { text: string }) => Promise<void>>(async () => {}),
}));

vi.mock("stripe", () => {
  function MockStripe() {
    return stripeMock;
  }
  MockStripe.createFetchHttpClient = () => ({});
  return { default: MockStripe };
});
vi.mock("../src/lib/email", () => ({ sendEmail }));

import { env, applyD1Migrations } from "cloudflare:test";
import { auth } from "../src/auth";
import { insertTask, getTask } from "../src/db/tasks";
import { bumpStoredUsage, readStoredUsage } from "../src/db/usage";
import { insertState, upsertConnection } from "../src/db/integrations";
import { sealTokens } from "../src/integrations/connection";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
beforeEach(() => vi.clearAllMocks());

/** Entra por magic link e devolve o id + o header de sessão do app (bearer). */
async function signedIn(email: string) {
  await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
  const token = /token=([A-Za-z]+)/.exec(sendEmail.mock.calls.at(-1)?.[1].text ?? "")?.[1] ?? "";
  const res = await auth.api.magicLinkVerify({ query: { token }, headers: new Headers() });
  return { id: res.user.id, headers: new Headers({ authorization: `Bearer ${res.token}` }) };
}

const task = (id: string) => ({
  id,
  title: "Some task",
  date: Date.now(),
  duration: "",
  priority: 0,
  repeat: "Off" as const,
  completed: [],
});

// Conta apagada leva os dados junto (a /privacidade promete) e a cobrança junto.
describe("auth.api.deleteUser", () => {
  it("cancela a assinatura ativa e apaga as tarefas", async () => {
    stripeMock.subscriptions.search.mockResolvedValue({
      data: [
        { id: "sub_1", status: "active" },
        { id: "sub_2", status: "canceled" }, // já cancelada: não tocar
      ],
    });
    const { id, headers } = await signedIn("payer@test.local");
    await insertTask(env.DB, id, task("d1"));

    await auth.api.deleteUser({ body: {}, headers });

    expect(stripeMock.subscriptions.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: `metadata['clerkUserId']:'${id}'` }),
    );
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledExactlyOnceWith("sub_1");
    expect(await getTask(env.DB, id, "d1")).toBeNull();
    expect(await env.DB.prepare(`SELECT 1 FROM "user" WHERE id=?`).bind(id).first()).toBeNull();
  });

  it("apaga os dados mesmo se o cancelamento falhar", async () => {
    stripeMock.subscriptions.search.mockRejectedValue(new Error("stripe down"));
    const { id, headers } = await signedIn("unlucky@test.local");
    await insertTask(env.DB, id, task("d2"));

    await auth.api.deleteUser({ body: {}, headers });
    expect(await getTask(env.DB, id, "d2")).toBeNull();
  });

  it("revoga as integrações e apaga elas, os states e o usage", async () => {
    stripeMock.subscriptions.search.mockResolvedValue({ data: [] });
    const { id, headers } = await signedIn("wiped@test.local");
    const now = Date.now();
    const tokens = await sealTokens(env, id, "google-calendar", {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: now + 3600_000,
      scope: "",
    });
    await upsertConnection(
      env.DB,
      id,
      "google-calendar",
      { accountId: "g1", email: null, scopes: "", tokens },
      now,
    );
    await env.DB.prepare(
      `INSERT INTO integration_links (user_id, provider, task_id, external_id, updated_at)
       VALUES (?, 'google-calendar', 't', 'e', 0)`,
    )
      .bind(id)
      .run();
    await insertState(
      env.DB,
      "st-wiped",
      { user_id: id, provider: "google-calendar", code_verifier: "v" },
      now + 60_000,
      now,
    );
    await bumpStoredUsage(env.DB, id, "ai", "2026-11");

    const revoked: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      revoked.push(new URLSearchParams(String(init?.body)).get("token") ?? "");
      return new Response(null, { status: 200 });
    });
    await auth.api.deleteUser({ body: {}, headers });
    vi.restoreAllMocks();

    expect(revoked).toEqual(["r"]);
    expect(await readStoredUsage(env.DB, id, "ai", "2026-11")).toBe(0);
    for (const table of ["integration_connections", "integration_links", "oauth_states"]) {
      const { results } = await env.DB.prepare(`SELECT 1 FROM ${table} WHERE user_id=?`)
        .bind(id)
        .all();
      expect(results, table).toHaveLength(0);
    }
  });
});
