import { describe, it, expect, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn<(env: unknown, mail: { text: string }) => Promise<void>>(async () => {}),
}));

vi.mock("stripe", () => import("./stripe"));
import { stripeMock } from "./stripe";
vi.mock("../src/lib/email", () => ({ sendEmail }));

import { env } from "cloudflare:test";
import { auth } from "../src/auth";
import { insertTask, getTask } from "../src/db/tasks";
import { USER_TABLES } from "../src/db/user";
import { bumpStoredUsage, readStoredUsage } from "../src/db/usage";
import { insertState, upsertConnection } from "../src/db/integrations";
import { sealTokens } from "../src/integrations/connection";

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
  it("deleteUserData covers every table with a user_id column", async () => {
    // instr over the DDL, not pragma_table_info, which workerd's authorizer may reject.
    const { results } = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND instr(sql, 'user_id') > 0`,
    ).all<{ name: string }>();
    expect(results.map((r) => r.name).sort()).toEqual([...USER_TABLES].sort());
  });

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

  it("esquece o e-mail: links pendentes, challenges, a vaga do limite e os vencidos", async () => {
    stripeMock.subscriptions.search.mockResolvedValue({ data: [] });
    const { headers } = await signedIn("forget@test.local");
    // Link do app pedido e não usado (passa do limite de um por minuto pela vaga apagada).
    await env.DB.prepare(`DELETE FROM magic_link_sent`).run();
    await auth.api.signInMagicLink({
      body: { email: "forget@test.local", metadata: { challenge: "c".repeat(43) } },
      headers: new Headers(),
    });
    await env.DB.prepare(
      `INSERT INTO verification (id, identifier, value, expiresAt, createdAt, updatedAt)
       VALUES ('old', 'x', 'y', '2000-01-01T00:00:00.000Z', '', '')`,
    ).run();

    await auth.api.deleteUser({ body: {}, headers });

    const count = (sql: string) => env.DB.prepare(sql).first<{ n: number }>();
    expect(
      await count(`SELECT COUNT(*) AS n FROM verification WHERE value LIKE '%forget@test.local%'`),
    ).toEqual({ n: 0 });
    expect(await count(`SELECT COUNT(*) AS n FROM verification WHERE id='old'`)).toEqual({ n: 0 });
    expect(await count(`SELECT COUNT(*) AS n FROM magic_link_challenge`)).toEqual({ n: 0 });
    expect(
      await count(`SELECT COUNT(*) AS n FROM magic_link_sent WHERE email='forget@test.local'`),
    ).toEqual({ n: 0 });
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
    await env.DB.prepare(
      `INSERT INTO mew_actions (id, user_id, action, task_ids, created_at)
       VALUES ('mw-wiped', ?, 'create', '[]', 0)`,
    )
      .bind(id)
      .run();

    const revoked: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      revoked.push(new URLSearchParams(String(init?.body)).get("token") ?? "");
      return new Response(null, { status: 200 });
    });
    await auth.api.deleteUser({ body: {}, headers });

    expect(revoked).toEqual(["r"]);
    expect(await readStoredUsage(env.DB, id, "ai", "2026-11")).toBe(0);
    for (const table of [
      "integration_connections",
      "integration_links",
      "oauth_states",
      "mew_actions",
    ]) {
      const { results } = await env.DB.prepare(`SELECT 1 FROM ${table} WHERE user_id=?`)
        .bind(id)
        .all();
      expect(results, table).toHaveLength(0);
    }
  });
});
