import { describe, it, expect, vi, beforeEach } from "vitest";

let userId = "";
let plan: "free" | "pro" = "pro";
vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: userId, plan }));

import { env } from "cloudflare:workers";
import { isRecord, type ProviderId } from "@dailify/shared";
import app from "../src/index";
import { gmail } from "../src/integrations/gmail";
import { sealTokens } from "../src/integrations/connection";
import { activeIntegrations, getConnection, upsertConnection } from "../src/db/integrations";
import { base64urlToBytes } from "../src/lib/encoding";
import { toBlocks } from "../src/lib/mew";
import * as google from "./fixtures/google-calendar";
import * as fixture from "./fixtures/gmail";

const ORIGIN = "https://mewki.mxrqz.com";
const TOKEN = "https://oauth2.googleapis.com/token";
const REVOKE = "https://oauth2.googleapis.com/revoke";

let routes: Record<string, () => Response>;
let calls: { url: string; body: string; auth: string | null }[];

beforeEach(() => {
  userId = `gmail-${crypto.randomUUID()}`;
  plan = "pro";
  calls = [];
  routes = {
    [TOKEN]: () => Response.json(fixture.token),
    "https://openidconnect.googleapis.com/v1/userinfo": () => Response.json(google.userinfo),
    [REVOKE]: () => new Response(""),
    [fixture.SEND]: () => Response.json(fixture.sent),
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

const callsTo = (url: string) => calls.filter((c) => c.url.split("?")[0] === url);
const request = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { origin: ORIGIN, ...init.headers } }, env);

async function seed(provider: ProviderId = "gmail") {
  const tokens = {
    accessToken: `ya29.${provider}`,
    refreshToken: `1//${provider}`,
    expiresAt: Date.now() + 3_600_000,
    scope: fixture.token.scope,
  };
  await upsertConnection(
    env.DB,
    userId,
    provider,
    {
      accountId: google.userinfo.sub,
      email: google.userinfo.email,
      scopes: tokens.scope,
      tokens: await sealTokens(env, userId, provider, tokens),
    },
    Date.now(),
  );
}

const utf8 = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

/** The sent RFC 2822 message: unfolded headers and the decoded body. */
function sentMessage() {
  const sent: unknown = JSON.parse(callsTo(fixture.SEND)[0].body);
  if (!isRecord(sent) || typeof sent.raw !== "string") throw new Error("no raw message");
  const mime = new TextDecoder().decode(base64urlToBytes(sent.raw));
  const [head, body] = [mime.slice(0, mime.indexOf("\r\n\r\n")), mime.split("\r\n\r\n")[1]];
  const headers = new Map(
    head
      .replace(/\r\n /g, " ")
      .split("\r\n")
      .map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 2)]),
  );
  return { head, headers, body: utf8(body.replace(/\r\n/g, "")) };
}

describe("Gmail connect and callback", () => {
  it("asks Google for gmail.send only, offline, and stores the address", async () => {
    const res = await request("/integrations/gmail/connect", { method: "POST" });
    const url = new URL((await res.json<{ url: string }>()).url);
    const q = url.searchParams;
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(q.get("client_id")).toBe(env.GOOGLE_CLIENT_ID);
    expect(q.get("scope")).toBe(`openid email ${fixture.SEND_SCOPE}`);
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("access_type")).toBe("offline");
    expect(q.get("include_granted_scopes")).toBeNull();
    expect(q.get("redirect_uri")).toBe(`${ORIGIN}/integrations/gmail/callback`);

    const done = await request("/integrations/gmail/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "c", state: q.get("state") }),
    });
    expect(done.status).toBe(200);
    expect(await done.json()).toMatchObject({ connected: true, account: google.userinfo.email });
    expect(await activeIntegrations(env.DB, userId, "pro")).toEqual(["gmail"]);
  });

  it("is Pro and up: Free gets 403 on connect", async () => {
    plan = "free";
    expect((await request("/integrations/gmail/connect", { method: "POST" })).status).toBe(403);
  });
});

describe("Gmail send", () => {
  beforeEach(() => seed());

  const subjectOf = (headers: Map<string, string>) =>
    [...(headers.get("Subject") ?? "").matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)]
      .map((w) => utf8(w[1]))
      .join("");

  it("posts a base64url message: the UTF-8 subject, the text as the body, and its sent link", async () => {
    const subject = "Reunião amanhã às 15h com a equipe toda, confirmada 🎉";
    const sent = await gmail.send?.(env, userId, " ana@exemplo.com ", {
      subject,
      text: "Oi Ana,\n\nAté lá.",
    });
    expect(sent).toEqual({ url: `https://mail.google.com/mail/u/0/#sent/${fixture.sent.id}` });
    expect(callsTo(fixture.SEND)[0].auth).toBe("Bearer ya29.gmail");

    const { head, headers, body } = sentMessage();
    expect(headers.get("To")).toBe("ana@exemplo.com");
    expect(headers.get("Content-Type")).toBe("text/plain; charset=UTF-8");
    expect(headers.has("Bcc")).toBe(false);
    expect(subjectOf(headers)).toBe(subject);
    for (const line of head.split("\r\n")) expect(line.length).toBeLessThanOrEqual(78);
    expect(body).toBe("Oi Ana,\r\n\r\nAté lá.");
  });

  it("an older draft without a subject still takes it from the first line", async () => {
    await gmail.send?.(env, userId, "ana@exemplo.com", { text: "Reunião\nOi Ana,\n\nAté lá." });
    const { headers, body } = sentMessage();
    expect(subjectOf(headers)).toBe("Reunião");
    expect(body).toBe("Oi Ana,\r\n\r\nAté lá.");
  });

  it.each(["Ana", "ana@exemplo.com, eu@x.com", "ana@exemplo.com\r\nBcc: eu@x.com", "<a@b.co>"])(
    "refuses %j before calling Gmail",
    async (target) => {
      await expect(gmail.send?.(env, userId, target, { text: "Oi\ncorpo" })).rejects.toThrow(
        /address/,
      );
      expect(callsTo(fixture.SEND)).toHaveLength(0);
    },
  );

  it("a 401 marks the connection revoked", async () => {
    routes[fixture.SEND] = () => Response.json(fixture.unauthorized, { status: 401 });
    await expect(
      gmail.send?.(env, userId, "ana@exemplo.com", { text: "Oi\ncorpo" }),
    ).rejects.toThrow(/401/);
    expect((await getConnection(env.DB, userId, "gmail"))?.status).toBe("revoked");
  });

  it("the send box shows the address it goes to, not the model's name for it", () => {
    const reply = toBlocks(
      {
        intent: "answer",
        reply: "Rascunho pronto.",
        show: [],
        proposals: [],
        send: { provider: "gmail", target: "x@evil.com", to: "Ana", text: "Oi\ncorpo" },
      },
      new Map(),
      "America/Sao_Paulo",
      [],
      Date.now(),
      [{ provider: "gmail", target: "e-mail", read: false, send: true }],
    );
    expect(reply.blocks).toEqual([expect.objectContaining({ kind: "send", to: "x@evil.com" })]);
  });
});

describe("Gmail disconnect", () => {
  beforeEach(() => seed());

  it("revokes the grant and deletes the row", async () => {
    expect((await request("/integrations/gmail", { method: "DELETE" })).status).toBe(204);
    expect(new URLSearchParams(callsTo(REVOKE)[0].body).get("token")).toBe("1//gmail");
    expect(await getConnection(env.DB, userId, "gmail")).toBeNull();
  });

  it("keeps Google's grant while the Calendar, on the same client, stays connected", async () => {
    await seed("google-calendar");
    expect((await request("/integrations/gmail", { method: "DELETE" })).status).toBe(204);
    expect(callsTo(REVOKE)).toHaveLength(0);
    expect(await getConnection(env.DB, userId, "gmail")).toBeNull();
    expect((await getConnection(env.DB, userId, "google-calendar"))?.status).toBe("active");
  });
});
