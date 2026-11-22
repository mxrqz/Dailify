import { describe, it, expect, vi } from "vitest";

type Mail = { to: string; subject: string; text: string };
const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn<(env: unknown, mail: Mail) => Promise<void>>(async () => {}),
}));
vi.mock("../src/lib/email", () => ({ sendEmail }));

import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { symmetricDecrypt } from "better-auth/crypto";
import { API_ERROR } from "@dailify/shared";
import app from "../src/index";
import { auth } from "../src/auth";
import { FIRST_FACTOR, TWO_FACTOR_HEADER } from "../src/auth-security";
import { sha256b64url } from "../src/lib/encoding";

const mailsTo = (to: string) => sendEmail.mock.calls.map(([, m]) => m).filter((m) => m.to === to);
const lastMailTo = (to: string) => mailsTo(to).at(-1);
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
// The real AUTH_LIMITER runs in tests (5/min per IP): every HTTP call comes from its own address.
const ip = () => ({ "cf-connecting-ip": crypto.randomUUID() });

/** Sends the sign-in e-mail again, past the one-a-minute cooldown. */
async function sendLink(email: string) {
  await env.DB.prepare(`DELETE FROM magic_link_sent WHERE email=?`).bind(email).run();
  await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
}

/** A magic-link first factor; resolves to Better Auth's answer and its headers. */
async function magicLink(email: string) {
  await sendLink(email);
  const token = /token=([A-Za-z]+)/.exec(lastMailTo(email)?.text ?? "")?.[1] ?? "";
  return auth.api.magicLinkVerify({
    query: { token },
    headers: new Headers(),
    returnHeaders: true,
  });
}

async function totp(userId: string): Promise<string> {
  const row = await env.DB.prepare(`SELECT secret FROM "twoFactor" WHERE userId=?`)
    .bind(userId)
    .first<{ secret: string }>();
  const secret = await symmetricDecrypt({ key: env.BETTER_AUTH_SECRET, data: row?.secret ?? "" });
  return (await auth.api.generateTOTP({ body: { secret } })).code;
}

/** A user with TOTP on; returns its id, a live session token and the recovery codes. */
async function mfaUser(email: string) {
  const { response } = await magicLink(email);
  if (!("token" in response)) throw new Error("expected a session");
  const userId = response.user.id;
  const enabled = await auth.api.enableTwoFactor({
    body: {},
    headers: new Headers(bearer(response.token)),
  });
  const backupCodes = enabled.method === "totp" ? enabled.backupCodes : [];
  const { headers } = await auth.api.verifyTOTP({
    body: { code: await totp(userId) },
    headers: new Headers(bearer(response.token)),
    returnHeaders: true,
  });
  return { userId, token: headers.get("set-auth-token") ?? "", backupCodes };
}

/** Second factor with the app's header, the only place the challenge lives there. */
const verifyWith = (path: string, challenge: string, body: Record<string, unknown>) =>
  app.request(
    `/auth/two-factor/${path}`,
    {
      method: "POST",
      headers: { "content-type": "application/json", [TWO_FACTOR_HEADER]: challenge, ...ip() },
      body: JSON.stringify(body),
    },
    env,
    createExecutionContext(),
  );

describe("MFA at sign-in", () => {
  it("gates every first-factor path, not only the plugin's /sign-in/email", () => {
    expect([...FIRST_FACTOR].sort()).toEqual(
      [
        "/callback/:id",
        "/magic-link/verify",
        "/sign-in/email",
        "/sign-in/email-otp",
        "/sign-in/social",
        "/verify-email",
      ].sort(),
    );
  });

  it("holds the magic-link session back and hands the app the challenge", async () => {
    const { userId } = await mfaUser("gate-link@test.local");
    const { response, headers } = await magicLink("gate-link@test.local");
    expect(response).toMatchObject({ twoFactorRedirect: true });
    expect(headers.get("set-auth-token")).toBeNull();
    const challenge = headers.get(TWO_FACTOR_HEADER) ?? "";
    expect(challenge).not.toBe("");

    const wrong = await verifyWith("verify-totp", challenge, { code: "000000" });
    expect(wrong.status).toBe(401);
    const res = await verifyWith("verify-totp", challenge, { code: await totp(userId) });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-auth-token")).toBeTruthy();
  });

  it("holds the e-mailed code's session back too", async () => {
    await mfaUser("gate-code@test.local");
    await sendLink("gate-code@test.local");
    const otp = /\b(\d{6})\b/.exec(lastMailTo("gate-code@test.local")?.text ?? "")?.[1] ?? "";
    const { response, headers } = await auth.api.signInEmailOTP({
      body: { email: "gate-code@test.local", otp },
      headers: new Headers(),
      returnHeaders: true,
    });
    expect(response).toMatchObject({ twoFactorRedirect: true });
    expect(headers.get("set-auth-token")).toBeNull();
  });

  it("sends Google's callback to the web's challenge page instead of signing in", async () => {
    await mfaUser("gate-google@test.local");
    const web = env.ALLOWED_ORIGIN.split(",")[0];
    const start = await app.request(
      "/auth/sign-in/social",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: web, ...ip() },
        body: JSON.stringify({ provider: "google", callbackURL: `${web}/settings` }),
      },
      env,
      createExecutionContext(),
    );
    const { url } = await start.json<{ url: string }>();
    const state = new URL(url).searchParams.get("state") ?? "";
    const cookies = (start.headers.get("set-cookie") ?? "")
      .split(/,(?=\s*[\w-]+=)/)
      .map((c) => c.split(";")[0].trim())
      .join("; ");

    // An unsigned id_token is enough: Better Auth decodes the one it just fetched over TLS.
    const claims = btoa(
      JSON.stringify({ sub: "g-1", email: "gate-google@test.local", email_verified: true }),
    ).replace(/=+$/, "");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const href = input instanceof Request ? input.url : String(input);
      if (!href.startsWith("https://oauth2.googleapis.com/token")) throw new Error(href);
      return Response.json({
        access_token: "at",
        id_token: `e30.${claims}.`,
        expires_in: 3600,
        token_type: "Bearer",
      });
    });
    const res = await app.request(
      `/auth/callback/google?code=c&state=${encodeURIComponent(state)}`,
      { headers: { cookie: cookies, ...ip() } },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${web}/two-factor?next=%2Fsettings`);
    expect(res.headers.get("set-cookie")).toMatch(/two_factor=2fa-/);
    expect(res.headers.get("set-cookie")).not.toMatch(/session_token=[^;]/);
  });

  it("leaves no session to mint the app's one-time token from", async () => {
    await mfaUser("gate-ott@test.local");
    const { response } = await magicLink("gate-ott@test.local");
    expect("token" in response).toBe(false);
    const challenge = await sha256b64url("v".repeat(43));
    await expect(
      auth.api.generateOneTimeToken({ query: { challenge }, headers: new Headers() }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("accepts each recovery code once", async () => {
    const { backupCodes } = await mfaUser("gate-backup@test.local");
    const first = (await magicLink("gate-backup@test.local")).headers.get(TWO_FACTOR_HEADER) ?? "";
    const ok = await verifyWith("verify-backup-code", first, { code: backupCodes[0] });
    expect(ok.status).toBe(200);

    const second = (await magicLink("gate-backup@test.local")).headers.get(TWO_FACTOR_HEADER) ?? "";
    const again = await verifyWith("verify-backup-code", second, { code: backupCodes[0] });
    expect(again.ok).toBe(false);
  });

  it("e-mails a code as the alternative factor", async () => {
    await mfaUser("gate-otp@test.local");
    const challenge = (await magicLink("gate-otp@test.local")).headers.get(TWO_FACTOR_HEADER) ?? "";
    expect((await verifyWith("send-otp", challenge, {})).status).toBe(200);
    await vi.waitFor(() =>
      expect(lastMailTo("gate-otp@test.local")?.text).toContain("verificação"),
    );
    const mail = lastMailTo("gate-otp@test.local");
    expect(mail?.subject).toBe("Seu código de verificação da Mewki");
    expect(mail?.text).toContain("vale por 5 minutos");
    const code = /\b(\d{6})\b/.exec(mail?.text ?? "")?.[1] ?? "";
    expect(mail?.subject).not.toContain(code);
    expect((await verifyWith("verify-otp", challenge, { code })).status).toBe(200);
  });

  it("skips the code on a device trusted for 30 days", async () => {
    const { userId } = await mfaUser("gate-trust@test.local");
    const challenge =
      (await magicLink("gate-trust@test.local")).headers.get(TWO_FACTOR_HEADER) ?? "";
    const res = await verifyWith("verify-totp", challenge, {
      code: await totp(userId),
      trustDevice: true,
    });
    const trust = /((?:__Secure-)?better-auth\.trust_device=[^;]+)/.exec(
      res.headers.get("set-cookie") ?? "",
    )?.[1];
    expect(trust).toBeTruthy();

    await sendLink("gate-trust@test.local");
    const token = /token=([A-Za-z]+)/.exec(lastMailTo("gate-trust@test.local")?.text ?? "")?.[1];
    const { response } = await auth.api.magicLinkVerify({
      query: { token: token ?? "" },
      headers: new Headers({ cookie: trust ?? "" }),
      returnHeaders: true,
    });
    expect("token" in response).toBe(true);
  });
});

describe("step-up", () => {
  const post = (path: string, token: string, body: unknown = {}) =>
    app.request(
      path,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer(token), ...ip() },
        body: JSON.stringify(body),
      },
      env,
      createExecutionContext(),
    );
  const age = (userId: string) =>
    env.DB.prepare(
      `UPDATE session_mfa SET verified_at=0 WHERE session_id IN (SELECT id FROM session WHERE userId=?)`,
    )
      .bind(userId)
      .run();

  it("blocks a sensitive route until a fresh code, then lets it through", async () => {
    const { userId, token } = await mfaUser("step-connect@test.local");
    await age(userId);
    const blocked = await post("/integrations/google-calendar/connect", token);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ code: API_ERROR.mfaRequired });

    expect(
      (await post("/auth/two-factor/verify-totp", token, { code: await totp(userId) })).status,
    ).toBe(200);
    expect((await post("/integrations/google-calendar/connect", token)).status).not.toBe(403);
  });

  it("needs a code to disable MFA, and mails the change", async () => {
    const { userId, token } = await mfaUser("step-off@test.local");
    await age(userId);
    expect((await post("/auth/two-factor/disable", token)).status).toBe(403);

    await post("/auth/two-factor/verify-totp", token, { code: await totp(userId) });
    const off = await post("/auth/two-factor/disable", token);
    expect(off.status).toBe(200);
    const row = await env.DB.prepare(`SELECT twoFactorEnabled FROM "user" WHERE id=?`)
      .bind(userId)
      .first();
    expect(row).toEqual({ twoFactorEnabled: 0 });
    await vi.waitFor(() =>
      expect(lastMailTo("step-off@test.local")?.subject).toBe(
        "Verificação em duas etapas desativada",
      ),
    );
  });

  it("locks step-up after ten wrong codes", async () => {
    const { userId, token } = await mfaUser("step-lock@test.local");
    for (let i = 0; i < 10; i++)
      await post("/auth/two-factor/verify-totp", token, { code: "000000" });
    const locked = await post("/auth/two-factor/verify-totp", token, { code: await totp(userId) });
    expect(locked.status).toBe(429);
  });
});

describe("security e-mails", () => {
  it("mails mfaOn when TOTP is turned on", async () => {
    await mfaUser("mail-on@test.local");
    // Security e-mails go out in `waitUntil`, after the response.
    await vi.waitFor(() =>
      expect(mailsTo("mail-on@test.local").map((m) => m.subject)).toContain(
        "Verificação em duas etapas ativada",
      ),
    );
  });

  it("mails a new device after its second factor, and a failed send doesn't fail the sign-in", async () => {
    const { userId } = await mfaUser("mail-new@test.local");
    // Old enough that its first session isn't the account's birth.
    await env.DB.prepare(`UPDATE "user" SET createdAt=? WHERE id=?`)
      .bind(new Date(0).toISOString(), userId)
      .run();
    const challenge = (await magicLink("mail-new@test.local")).headers.get(TWO_FACTOR_HEADER) ?? "";
    sendEmail.mockRejectedValueOnce(new Error("mail down"));
    const res = await app.request(
      "/auth/two-factor/verify-totp",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [TWO_FACTOR_HEADER]: challenge,
          "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
          ...ip(),
        },
        body: JSON.stringify({ code: await totp(userId) }),
      },
      env,
      createExecutionContext(),
    );
    expect(res.status).toBe(200);
    await vi.waitFor(() =>
      expect(sendEmail.mock.calls.at(-1)?.[1].subject).toBe("Novo acesso à sua conta da Mewki"),
    );
  });
});
