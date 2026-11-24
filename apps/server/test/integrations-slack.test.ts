import { describe, it, expect, vi, beforeEach } from "vitest";

let userId = "";
let plan: "free" | "pro" = "pro";
vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: userId, plan }));

import { env } from "cloudflare:workers";
import app from "../src/index";
import { slack } from "../src/integrations/slack";
import { openTokens, sealTokens } from "../src/integrations/connection";
import {
  activeIntegrations,
  aiTargets,
  getConnection,
  upsertConnection,
} from "../src/db/integrations";
import { saveSettings } from "../src/db/settings";

const API = "https://slack.com/api";
const ORIGIN = "https://mewki.mxrqz.com";
const SCOPE =
  "channels:read,channels:history,groups:read,groups:history,im:read,im:history,mpim:read,mpim:history,users:read,chat:write";

const ok = (body: object) => Response.json({ ok: true, ...body });
let routes: Record<string, () => Response>;
let calls: { url: string; body: string; auth: string | null }[];

beforeEach(async () => {
  userId = `slack-${crypto.randomUUID()}`;
  plan = "pro";
  calls = [];
  routes = {
    [`${API}/oauth.v2.access`]: () =>
      ok({
        app_id: "A1",
        team: { id: "T1", name: "Acme" },
        authed_user: { id: "U1", scope: SCOPE, access_token: "xoxp-1", token_type: "user" },
      }),
    [`${API}/auth.test`]: () =>
      ok({ url: "https://acme.slack.com/", team: "Acme", team_id: "T1", user_id: "U1" }),
    [`${API}/auth.revoke`]: () => ok({ revoked: true }),
    [`${API}/users.list`]: () =>
      ok({
        members: [
          { id: "U1", name: "eu", real_name: "Eu Mesma", profile: { display_name: "" } },
          { id: "U2", name: "joao", real_name: "João Silva", profile: { display_name: "João" } },
        ],
      }),
    [`${API}/conversations.list`]: () =>
      ok({
        channels: [
          { id: "C100GERAL", name: "geral", is_channel: true },
          { id: "D200JOAO", is_im: true, user: "U2" },
        ],
      }),
    // Newest first, as Slack answers.
    [`${API}/conversations.history`]: () =>
      ok({
        messages: [
          { user: "U1", text: "vou ver", ts: "1763740800.000200" },
          { user: "U2", text: "<@U1> pode revisar o PR?", ts: "1763737200.000100" },
        ],
      }),
    [`${API}/conversations.replies`]: () =>
      ok({ messages: [{ user: "U2", text: "thread raiz", ts: "1763737200.000100" }] }),
    [`${API}/conversations.info`]: () => ok({ channel: { id: "C100GERAL", name: "geral" } }),
    [`${API}/chat.postMessage`]: () => ok({ ts: "1763740900.000300" }),
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({
      url,
      body: String(init?.body ?? ""),
      auth: new Headers(init?.headers).get("authorization"),
    });
    const route = routes[url.split("?")[0]];
    if (!route) throw new Error(`fetch não mockado: ${url}`);
    return route();
  });
});

const callsTo = (method: string) => calls.filter((c) => c.url.split("?")[0] === `${API}/${method}`);
const query = (method: string) => new URL(callsTo(method)[0].url).searchParams;
const request = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { origin: ORIGIN, ...init.headers } }, env);

async function seed() {
  const tokens = { accessToken: "xoxp-1", expiresAt: Date.now() + 3_600_000, scope: SCOPE };
  await upsertConnection(
    env.DB,
    userId,
    "slack",
    {
      accountId: "T1:U1",
      email: "acme.slack.com",
      scopes: SCOPE,
      tokens: await sealTokens(env, userId, "slack", tokens),
    },
    Date.now(),
  );
}

describe("Slack connect and callback", () => {
  it("asks for user scopes without PKCE and stores the sealed user token", async () => {
    const res = await request("/integrations/slack/connect", { method: "POST" });
    const url = new URL((await res.json<{ url: string }>()).url);
    expect(url.origin + url.pathname).toBe("https://slack.com/oauth/v2/authorize");
    expect(url.searchParams.get("user_scope")).toBe(SCOPE);
    expect(url.searchParams.get("scope")).toBeNull();
    expect(url.searchParams.get("code_challenge")).toBeNull();
    expect(url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/integrations/slack/callback`);

    const done = await request("/integrations/slack/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "c", state: url.searchParams.get("state") }),
    });
    expect(done.status).toBe(200);
    expect(await done.json()).toMatchObject({ connected: true, account: "acme.slack.com" });
    const sent = new URLSearchParams(callsTo("oauth.v2.access")[0].body);
    expect(sent.get("code_verifier")).toBeNull();
    expect(callsTo("auth.test")[0].auth).toBe("Bearer xoxp-1");

    const row = await getConnection(env.DB, userId, "slack");
    expect(row?.tokens).not.toContain("xoxp");
    const tokens = await openTokens(env, userId, "slack", row?.tokens ?? "");
    expect(tokens).toMatchObject({ accessToken: "xoxp-1", scope: SCOPE });
    expect(tokens.refreshToken).toBeUndefined();
  });

  it("is Pro and up: Free gets 403 on connect", async () => {
    plan = "free";
    expect((await request("/integrations/slack/connect", { method: "POST" })).status).toBe(403);
  });

  it("is a Mew app, never a task target", async () => {
    await seed();
    expect(await activeIntegrations(env.DB, userId, "pro")).toEqual(["slack"]);
    expect(await aiTargets(env.DB, userId, "pro")).toEqual([]);
    expect(await activeIntegrations(env.DB, userId, "free")).toEqual([]);
  });
});

describe("Slack read", () => {
  beforeEach(async () => {
    await seed();
    await saveSettings(env.DB, userId, { timeZone: "America/Sao_Paulo" });
  });

  it("a channel: one history call, oldest first, names and local time", async () => {
    const { text, card } = (await slack.read?.(env, userId, "#geral")) ?? {};
    expect(callsTo("conversations.history")).toHaveLength(1);
    expect(callsTo("conversations.replies")).toHaveLength(0);
    expect(query("conversations.history").get("channel")).toBe("C100GERAL");
    expect(query("conversations.history").get("limit")).toBe("15");
    expect(text).toBe(
      "João (2025-11-21 12:00): @Eu Mesma pode revisar o PR?\nEu Mesma (2025-11-21 13:00): vou ver",
    );
    expect(callsTo("conversations.info")).toHaveLength(0);
    expect(card).toEqual({
      provider: "slack",
      source: "#geral",
      url: "https://acme.slack.com/archives/C100GERAL",
      total: 2,
      items: [
        {
          title: "vou ver",
          url: "https://acme.slack.com/archives/C100GERAL/p1763740800000200",
          icon: "message",
          author: "Eu Mesma",
          at: 1763740800000,
        },
        {
          title: "@Eu Mesma pode revisar o PR?",
          url: "https://acme.slack.com/archives/C100GERAL/p1763737200000100",
          icon: "message",
          author: "João",
          at: 1763737200000,
          mention: true,
        },
      ],
    });
  });

  it("a DM card is titled by the person, and replies count", async () => {
    routes[`${API}/conversations.history`] = () =>
      ok({ messages: [{ user: "U2", text: "oi", ts: "1763737200.000100", reply_count: 6 }] });
    const card = (await slack.read?.(env, userId, "@joão"))?.card;
    expect(card?.source).toBe("@João");
    expect(card?.items[0]).toMatchObject({ replies: 6 });
  });

  it("*: the workspace, the user and the conversations they're in, by name", async () => {
    routes[`${API}/conversations.list`] = () =>
      ok({
        channels: [
          { id: "C100GERAL", name: "geral", is_channel: true, is_member: true },
          { id: "C300PROJ", name: "projeto", is_private: true, is_member: true },
          { id: "C400OUTRO", name: "outro", is_channel: true, is_member: false },
          { id: "D200JOAO", is_im: true, user: "U2" },
        ],
      });
    expect(await slack.read?.(env, userId, "*")).toEqual({
      text: [
        "Workspace: Acme (https://acme.slack.com/); a pessoa é @Eu Mesma",
        "Canais em que ela está: #geral, #projeto (privado)",
        "DMs: @João",
      ].join("\n"),
    });
    expect(callsTo("conversations.history")).toHaveLength(0);
  });

  it("a person: their DM", async () => {
    await slack.read?.(env, userId, "@joão");
    expect(query("conversations.history").get("channel")).toBe("D200JOAO");
  });

  it("a permalink: one replies call on the thread root", async () => {
    const read = await slack.read?.(
      env,
      userId,
      "https://acme.slack.com/archives/C100GERAL/p1763737300000900?thread_ts=1763737200.000100&cid=C100GERAL",
    );
    expect(callsTo("conversations.list")).toHaveLength(0);
    expect(callsTo("conversations.history")).toHaveLength(0);
    expect(query("conversations.replies").get("ts")).toBe("1763737200.000100");
    expect(read?.text).toContain("thread raiz");
    // A permalink names no channel: the card asks Slack for it.
    expect(read?.card?.source).toBe("#geral");
  });

  it("a 429 reads back as a readable note with the wait", async () => {
    routes[`${API}/conversations.history`] = () =>
      new Response("", { status: 429, headers: { "retry-after": "42" } });
    expect(await slack.read?.(env, userId, "C100GERAL")).toEqual({
      text: expect.stringMatching(/rate limiting.*42 s/),
    });
  });

  it("an unknown name reads back as a note, not a failure", async () => {
    expect((await slack.read?.(env, userId, "#nada"))?.text).toMatch(/No Slack conversation/);
  });
});

describe("Slack send and disconnect", () => {
  beforeEach(seed);

  it("posts as the user to a channel", async () => {
    await slack.send?.(env, userId, "#geral", "oi");
    const sent = callsTo("chat.postMessage")[0];
    expect(sent.auth).toBe("Bearer xoxp-1");
    expect(JSON.parse(sent.body)).toEqual({ channel: "C100GERAL", text: "oi" });
  });

  it("replies in the thread of a permalink", async () => {
    await slack.send?.(
      env,
      userId,
      "https://acme.slack.com/archives/C100GERAL/p1763737200000100",
      "ok",
    );
    expect(JSON.parse(callsTo("chat.postMessage")[0].body)).toEqual({
      channel: "C100GERAL",
      text: "ok",
      thread_ts: "1763737200.000100",
    });
  });

  it("a revoked token marks the connection revoked", async () => {
    routes[`${API}/chat.postMessage`] = () => Response.json({ ok: false, error: "token_revoked" });
    await expect(slack.send?.(env, userId, "C100GERAL", "oi")).rejects.toThrow(/token_revoked/);
    expect((await getConnection(env.DB, userId, "slack"))?.status).toBe("revoked");
  });

  it("disconnect revokes the user token and deletes the row", async () => {
    expect((await request("/integrations/slack", { method: "DELETE" })).status).toBe(204);
    expect(new URLSearchParams(callsTo("auth.revoke")[0].body).get("token")).toBe("xoxp-1");
    expect(await getConnection(env.DB, userId, "slack")).toBeNull();
  });
});
