import { describe, it, expect, vi, beforeEach } from "vitest";

let userId = "iu1";
vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: userId }));

import { env } from "cloudflare:test";
import { APP_URL, INTEGRATIONS, PROVIDER_IDS, type IntegrationStatus } from "@dailify/shared";
import app from "../src/index";
import { seal, unseal } from "../src/integrations/crypto";
import { InvalidGrantError } from "../src/integrations/oauth";
import { sha256b64url as challengeOf } from "../src/lib/encoding";
import { PROVIDERS } from "../src/integrations/registry";
import { loadCtx, openTokens, sealTokens } from "../src/integrations/connection";
import { getConnection, insertState, upsertConnection } from "../src/db/integrations";
import * as google from "./fixtures/google-calendar";

const TOKEN = "https://oauth2.googleapis.com/token";
const REVOKE = "https://oauth2.googleapis.com/revoke";
const USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const ORIGIN = "https://mewki.mxrqz.com";
const STATE_AGE = 11 * 60_000;

let routes: Record<string, () => Response>;
let calls: { url: string; body: string; auth: string | null }[];

beforeEach(() => {
  userId = `iu-${crypto.randomUUID()}`;
  calls = [];
  routes = {
    [TOKEN]: () => Response.json(google.token),
    [USERINFO]: () => Response.json(google.userinfo),
    [REVOKE]: () => new Response(null, { status: 200 }),
    "https://api.test/ping": () => new Response("pong"),
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const auth = new Headers(init?.headers).get("authorization");
    calls.push({ url, body: String(init?.body ?? ""), auth });
    const route = routes[url.split("?")[0]];
    if (!route) throw new Error(`fetch não mockado: ${url}`);
    return route();
  });
});

const callsTo = (url: string) => calls.filter((c) => c.url === url);

const request = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { origin: ORIGIN, ...init.headers } }, env);

const callback = (body: unknown) =>
  request("/integrations/google-calendar/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function connect(): Promise<URL> {
  const res = await request("/integrations/google-calendar/connect", { method: "POST" });
  expect(res.status).toBe(200);
  return new URL((await res.json<{ url: string }>()).url);
}

async function seedConnection(tokens: { expiresAt: number; refreshToken?: string }) {
  const sealed = await sealTokens(env, userId, "google-calendar", {
    accessToken: "ya29.old",
    scope: google.token.scope,
    ...tokens,
  });
  await upsertConnection(
    env.DB,
    userId,
    "google-calendar",
    { accountId: "1098765", email: "pessoa@gmail.com", scopes: google.token.scope, tokens: sealed },
    Date.now(),
  );
}

describe("crypto", () => {
  it("ida e volta, IV novo a cada escrita, prefixo v1", async () => {
    const a = await seal(env, "segredo", "u:google-calendar");
    const b = await seal(env, "segredo", "u:google-calendar");
    expect(a).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
    expect(a).not.toBe(b);
    expect(await unseal(env, a, "u:google-calendar")).toBe("segredo");
  });

  it("AAD de outra linha não decifra", async () => {
    const sealed = await seal(env, "segredo", "u1:google-calendar");
    await expect(unseal(env, sealed, "u2:google-calendar")).rejects.toThrow();
  });

  it("versão desconhecida é recusada", async () => {
    const sealed = await seal(env, "segredo", "u:p");
    await expect(unseal(env, sealed.replace(/^v1/, "v9"), "u:p")).rejects.toThrow(/malformado/);
  });
});

describe("PKCE", () => {
  it("S256 bate com o vetor da RFC 7636", async () => {
    expect(await challengeOf("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});

describe("POST /integrations/:provider/connect", () => {
  it("devolve a URL do Google com PKCE, offline e redirect pro SPA; grava o state", async () => {
    const url = await connect();
    const q = url.searchParams;
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(q.get("client_id")).toBe(env.GOOGLE_CLIENT_ID);
    expect(q.get("redirect_uri")).toBe(`${ORIGIN}/integrations/google-calendar/callback`);
    expect(q.get("scope")).toBe(`openid email ${google.EVENTS_SCOPE}`);
    expect(q.get("response_type")).toBe("code");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("access_type")).toBe("offline");
    expect(q.get("prompt")).toBe("consent");
    expect(q.get("include_granted_scopes")).toBe("true");

    const row = await env.DB.prepare(`SELECT * FROM oauth_states WHERE state=?`)
      .bind(q.get("state"))
      .first<{ user_id: string; code_verifier: string; expires_at: number }>();
    expect(row?.user_id).toBe(userId);
    expect(await challengeOf(row?.code_verifier ?? "")).toBe(q.get("code_challenge"));
    expect(row?.expires_at).toBeGreaterThan(Date.now() + 9 * 60_000);
  });

  it("from the app, redirects through /app/* on the web domain, not the webview origin", async () => {
    const res = await request("/integrations/google-calendar/connect", {
      method: "POST",
      headers: { origin: "tauri://localhost" },
    });
    const url = new URL((await res.json<{ url: string }>()).url);
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${APP_URL}/app/integrations/google-calendar/callback`,
    );
  });

  it("provider desconhecido -> 404", async () => {
    expect((await request("/integrations/slak/connect", { method: "POST" })).status).toBe(404);
  });

  it("plano sem a integração -> 403 no connect; GET mostra allowed=false", async () => {
    const roles = INTEGRATIONS["google-calendar"].roles;
    INTEGRATIONS["google-calendar"].roles = ["max"];
    try {
      const res = await request("/integrations/google-calendar/connect", { method: "POST" });
      expect(res.status).toBe(403);
      const list = await (await request("/integrations")).json<IntegrationStatus[]>();
      expect(list).toContainEqual({
        provider: "google-calendar",
        allowed: false,
        configured: true,
        connected: false,
      });
    } finally {
      INTEGRATIONS["google-calendar"].roles = roles;
    }
  });
});

describe("POST /integrations/:provider/callback", () => {
  it("caminho feliz: troca com o mesmo verifier/redirect, identifica e grava cifrado", async () => {
    const url = await connect();
    const res = await callback({ code: "4/code", state: url.searchParams.get("state") });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      provider: "google-calendar",
      allowed: true,
      configured: true,
      connected: true,
      status: "active",
      account: "pessoa@gmail.com",
      imported: 0,
    });
    const body = new URLSearchParams(callsTo(TOKEN)[0].body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("redirect_uri")).toBe(url.searchParams.get("redirect_uri"));
    expect(await challengeOf(body.get("code_verifier") ?? "")).toBe(
      url.searchParams.get("code_challenge"),
    );
    expect(callsTo(USERINFO)[0].auth).toBe("Bearer ya29.access-1");

    const row = await getConnection(env.DB, userId, "google-calendar");
    expect(row?.account_id).toBe("1098765");
    expect(row?.tokens).toMatch(/^v1\./);
    expect(row?.tokens).not.toContain("ya29");
    const tokens = await openTokens(env, userId, "google-calendar", row?.tokens ?? "");
    expect(tokens.refreshToken).toBe("1//refresh-1");

    const list = await (await request("/integrations")).json<IntegrationStatus[]>();
    expect(list[0]).toMatchObject({ connected: true, status: "active" });
  });

  it("state de outra conta -> 403 e nada gravado", async () => {
    const url = await connect();
    const owner = userId;
    userId = "intruso";
    const res = await callback({ code: "4/code", state: url.searchParams.get("state") });
    expect(res.status).toBe(403);
    expect(callsTo(TOKEN)).toHaveLength(0);
    expect(await getConnection(env.DB, "intruso", "google-calendar")).toBeNull();
    expect(await getConnection(env.DB, owner, "google-calendar")).toBeNull();
  });

  it("state reusado -> 400", async () => {
    const state = (await connect()).searchParams.get("state");
    expect((await callback({ code: "4/code", state })).status).toBe(200);
    expect((await callback({ code: "4/code", state })).status).toBe(400);
  });

  it("state vencido -> 400", async () => {
    const now = Date.now();
    await insertState(
      env.DB,
      "velho",
      { user_id: userId, provider: "google-calendar", code_verifier: "v" },
      now - 1,
      now - STATE_AGE,
    );
    expect((await callback({ code: "4/code", state: "velho" })).status).toBe(400);
    expect(callsTo(TOKEN)).toHaveLength(0);
  });

  it("body sem code/state -> 400", async () => {
    expect((await callback({ state: "x" })).status).toBe(400);
  });

  it("scope de agenda desmarcado -> 400, revoga o grant e não grava", async () => {
    routes[TOKEN] = () => Response.json(google.tokenWithoutCalendar);
    const url = await connect();
    const res = await callback({ code: "4/code", state: url.searchParams.get("state") });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "missing_scope" });
    expect(callsTo(REVOKE)).toHaveLength(1);
    expect(await getConnection(env.DB, userId, "google-calendar")).toBeNull();
  });
});

describe("Ctx.api", () => {
  it("renova perto do vencimento e persiste os tokens novos", async () => {
    await seedConnection({ expiresAt: Date.now() + 30_000, refreshToken: "1//refresh-1" });
    routes[TOKEN] = () => Response.json(google.refreshed);
    const ctx = await loadCtx(env, userId, "google-calendar");
    await ctx?.api("https://api.test/ping");

    expect(new URLSearchParams(callsTo(TOKEN)[0].body).get("grant_type")).toBe("refresh_token");
    expect(callsTo("https://api.test/ping")[0].auth).toBe("Bearer ya29.access-2");
    const row = await getConnection(env.DB, userId, "google-calendar");
    const saved = await openTokens(env, userId, "google-calendar", row?.tokens ?? "");
    expect(saved.accessToken).toBe("ya29.access-2");
    expect(saved.refreshToken).toBe("1//refresh-1"); // o Google não devolve outro: mantém o antigo
  });

  it("token ainda válido não renova", async () => {
    await seedConnection({ expiresAt: Date.now() + 30 * 60_000, refreshToken: "1//refresh-1" });
    await (await loadCtx(env, userId, "google-calendar"))?.api("https://api.test/ping");
    expect(callsTo(TOKEN)).toHaveLength(0);
  });

  it("every provider and token call carries a timeout signal", async () => {
    await seedConnection({ expiresAt: Date.now() + 30_000, refreshToken: "1//refresh-1" });
    routes[TOKEN] = () => Response.json(google.refreshed);
    await (await loadCtx(env, userId, "google-calendar"))?.api("https://api.test/ping");
    const signals = vi.mocked(fetch).mock.calls.map(([, init]) => init?.signal);
    expect(signals).toHaveLength(2);
    for (const s of signals) expect(s).toBeInstanceOf(AbortSignal);
  });

  it("invalid_grant marca a conexão revogada", async () => {
    await seedConnection({ expiresAt: Date.now() - 1, refreshToken: "1//morto" });
    routes[TOKEN] = () => Response.json(google.invalidGrant, { status: 400 });
    const ctx = await loadCtx(env, userId, "google-calendar");
    await expect(ctx?.api("https://api.test/ping")).rejects.toBeInstanceOf(InvalidGrantError);

    expect((await getConnection(env.DB, userId, "google-calendar"))?.status).toBe("revoked");
    expect(await loadCtx(env, userId, "google-calendar")).toBeNull();
    const list = await (await request("/integrations")).json<IntegrationStatus[]>();
    expect(list[0]).toMatchObject({ connected: true, status: "revoked" });
  });
});

describe("DELETE /integrations/:provider", () => {
  it("revoga no Google e apaga conexão e vínculos", async () => {
    await seedConnection({ expiresAt: Date.now() + 60 * 60_000, refreshToken: "1//refresh-1" });
    await env.DB.prepare(
      `INSERT INTO integration_links (user_id, provider, task_id, external_id, updated_at)
       VALUES (?, 'google-calendar', 't1', 'ev1', 0)`,
    )
      .bind(userId)
      .run();

    const res = await request("/integrations/google-calendar", { method: "DELETE" });
    expect(res.status).toBe(204);
    expect(new URLSearchParams(callsTo(REVOKE)[0].body).get("token")).toBe("1//refresh-1");
    expect(await getConnection(env.DB, userId, "google-calendar")).toBeNull();
    const links = await env.DB.prepare(`SELECT 1 FROM integration_links WHERE user_id=?`)
      .bind(userId)
      .all();
    expect(links.results).toHaveLength(0);
  });

  it("revogação falhando não segura a desconexão", async () => {
    await seedConnection({ expiresAt: Date.now() + 60 * 60_000, refreshToken: "1//refresh-1" });
    routes[REVOKE] = () => new Response("down", { status: 503 });
    expect((await request("/integrations/google-calendar", { method: "DELETE" })).status).toBe(204);
    expect(await getConnection(env.DB, userId, "google-calendar")).toBeNull();
  });
});

describe("contrato dos providers", () => {
  it.each(PROVIDER_IDS)("%s tem endpoints, scopes e identify", (id) => {
    const p = PROVIDERS[id];
    expect(p.id).toBe(id);
    for (const url of [p.oauth.authorizeUrl, p.oauth.tokenUrl, p.oauth.revokeUrl])
      expect(new URL(url).protocol).toBe("https:");
    expect(p.oauth.scopes.length).toBeGreaterThan(0);
    expect(p.oauth.required.every((s) => p.oauth.scopes.includes(s))).toBe(true);
    expect(p.oauth.credentials(env).id).toBeTruthy();
    expect(typeof p.identify).toBe("function");
  });
});
