import { describe, it, expect, vi } from "vitest";

type Mail = { to: string; subject: string; text: string };
const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn<(env: unknown, mail: Mail) => Promise<void>>(async () => {}),
}));
vi.mock("../src/lib/email", () => ({ sendEmail }));

import { env } from "cloudflare:workers";
import { createExecutionContext } from "cloudflare:test";
import { symmetricDecrypt } from "better-auth/crypto";
import { API_ERROR, isRecord } from "@dailify/shared";
import app from "../src/index";
import { auth } from "../src/auth";
import { base64urlToBytes, bytesToBase64url } from "../src/lib/encoding";

const web = env.ALLOWED_ORIGIN.split(",")[0];
const subjectsTo = (to: string) =>
  sendEmail.mock.calls
    .map(([, m]) => m)
    .filter((m) => m.to === to)
    .map((m) => m.subject);
// The real AUTH_LIMITER runs in tests (5/min per IP): every HTTP call comes from its own address.
const ip = () => ({ "cf-connecting-ip": crypto.randomUUID() });

async function session(email: string) {
  await env.DB.prepare(`DELETE FROM magic_link_sent WHERE email=?`).bind(email).run();
  await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
  const mail = sendEmail.mock.calls.map(([, m]) => m).findLast((m) => m.to === email);
  const token = /token=([A-Za-z]+)/.exec(mail?.text ?? "")?.[1] ?? "";
  const res = await auth.api.magicLinkVerify({ query: { token }, headers: new Headers() });
  if (!("token" in res)) throw new Error("expected a session");
  return { userId: res.user.id, token: res.token };
}

async function totp(userId: string): Promise<string> {
  const row = await env.DB.prepare(`SELECT secret FROM "twoFactor" WHERE userId=?`)
    .bind(userId)
    .first<{ secret: string }>();
  const secret = await symmetricDecrypt({ key: env.BETTER_AUTH_SECRET, data: row?.secret ?? "" });
  return (await auth.api.generateTOTP({ body: { secret } })).code;
}

/** A session that turned TOTP on, then let its second factor go stale. */
async function staleMfaSession(email: string) {
  const { userId, token } = await session(email);
  await auth.api.enableTwoFactor({
    body: {},
    headers: new Headers({ authorization: `Bearer ${token}` }),
  });
  const { headers } = await auth.api.verifyTOTP({
    body: { code: await totp(userId) },
    headers: new Headers({ authorization: `Bearer ${token}` }),
    returnHeaders: true,
  });
  await env.DB.prepare(
    `UPDATE session_mfa SET verified_at=0 WHERE session_id IN (SELECT id FROM session WHERE userId=?)`,
  )
    .bind(userId)
    .run();
  return { userId, token: headers.get("set-auth-token") ?? "" };
}

const call = (path: string, headers: Record<string, string>, body?: unknown) =>
  app.request(
    `/auth/passkey/${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", origin: web, ...ip(), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
    createExecutionContext(),
  );

const cookieOf = (res: Response) =>
  /((?:__Secure-)?better-auth\.better-auth-passkey=[^;]+)/.exec(
    res.headers.get("set-cookie") ?? "",
  )?.[1] ?? "";

// A software authenticator: one P-256 key, "none" attestation, user present and verified.
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((at, p) => (out.set(p, at), at + p.length), 0);
  return out;
};
const cborBytes = (b: Uint8Array) =>
  cat(new Uint8Array(b.length < 24 ? [0x40 + b.length] : [0x58, b.length]), b);
const cborText = (s: string) => {
  const b = new TextEncoder().encode(s);
  return cat(new Uint8Array([0x60 + b.length]), b);
};
const sha256 = async (b: Uint8Array) => new Uint8Array(await crypto.subtle.digest("SHA-256", b));
/** WebCrypto signs r||s; WebAuthn carries ES256 signatures as DER. */
const der = (raw: Uint8Array) => {
  const int = (x: Uint8Array) => {
    let i = 0;
    while (i < x.length - 1 && x[i] === 0) i++;
    const v = x.slice(i);
    return v[0] & 0x80 ? cat(new Uint8Array([0]), v) : v;
  };
  const [r, s] = [int(raw.slice(0, 32)), int(raw.slice(32))];
  const body = cat(new Uint8Array([2, r.length]), r, new Uint8Array([2, s.length]), s);
  return cat(new Uint8Array([0x30, body.length]), body);
};

async function authenticator() {
  const keys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  if (!("publicKey" in keys)) throw new Error("expected a key pair");
  const jwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  if (jwk instanceof ArrayBuffer) throw new Error("expected a JWK");
  const cose = cat(
    new Uint8Array([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    base64urlToBytes(jwk.x ?? ""),
    new Uint8Array([0x22, 0x58, 0x20]),
    base64urlToBytes(jwk.y ?? ""),
  );
  const id = crypto.getRandomValues(new Uint8Array(16));
  const credentialId = bytesToBase64url(id);
  const rpHash = await sha256(new TextEncoder().encode(new URL(web).hostname));
  const clientData = (type: string, challenge: string) =>
    new TextEncoder().encode(JSON.stringify({ type, challenge, origin: web, crossOrigin: false }));

  return {
    credentialId,
    register: (challenge: string) => {
      const authData = cat(
        rpHash,
        new Uint8Array([0x45, 0, 0, 0, 0]),
        new Uint8Array(16),
        new Uint8Array([0, 16]),
        id,
        cose,
      );
      const attestation = cat(
        new Uint8Array([0xa3]),
        cborText("fmt"),
        cborText("none"),
        cborText("attStmt"),
        new Uint8Array([0xa0]),
        cborText("authData"),
        cborBytes(authData),
      );
      return {
        id: credentialId,
        rawId: credentialId,
        type: "public-key",
        response: {
          clientDataJSON: bytesToBase64url(clientData("webauthn.create", challenge)),
          attestationObject: bytesToBase64url(attestation),
          transports: ["internal"],
        },
        clientExtensionResults: {},
      };
    },
    assert: async (challenge: string) => {
      const authData = cat(rpHash, new Uint8Array([0x05, 0, 0, 0, 1]));
      const json = clientData("webauthn.get", challenge);
      const signed = cat(authData, await sha256(json));
      const raw = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        keys.privateKey,
        signed,
      );
      return {
        id: credentialId,
        rawId: credentialId,
        type: "public-key",
        response: {
          clientDataJSON: bytesToBase64url(json),
          authenticatorData: bytesToBase64url(authData),
          signature: bytesToBase64url(der(new Uint8Array(raw))),
        },
        clientExtensionResults: {},
      };
    },
  };
}

/** Registers a passkey through the real ceremony; resolves to the verify response. */
async function register(token: string, key: Awaited<ReturnType<typeof authenticator>>) {
  const bearer = { authorization: `Bearer ${token}` };
  const options = await call("generate-register-options", bearer);
  const { challenge } = await options.json<{ challenge: string }>();
  return call(
    "verify-registration",
    { ...bearer, cookie: cookieOf(options) },
    { response: key.register(challenge), name: "Pixel" },
  );
}

describe("passkey registration", () => {
  it("needs a session", async () => {
    expect((await call("generate-register-options", {})).status).toBe(401);
  });

  it("needs a recent second factor when MFA is on", async () => {
    const { userId, token } = await staleMfaSession("pk-stepup@test.local");
    const bearer = { authorization: `Bearer ${token}` };
    const blocked = await call("generate-register-options", bearer);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ code: API_ERROR.mfaRequired });

    await app.request(
      "/auth/two-factor/verify-totp",
      {
        method: "POST",
        headers: { "content-type": "application/json", ...bearer, ...ip() },
        body: JSON.stringify({ code: await totp(userId) }),
      },
      env,
      createExecutionContext(),
    );
    const options = await call("generate-register-options", bearer);
    expect(options.status).toBe(200);
    expect(await options.json()).toMatchObject({
      rp: { id: new URL(web).hostname, name: "Mewki" },
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
    });
  });

  it("stores the passkey and mails the change", async () => {
    const { token } = await session("pk-add@test.local");
    const res = await register(token, await authenticator());
    expect(await res.json()).toMatchObject({ name: "Pixel" });
    expect(res.status).toBe(200);
    await vi.waitFor(() =>
      expect(subjectsTo("pk-add@test.local")).toContain("Uma passkey foi adicionada"),
    );
  });
});

describe("passkey sign-in", () => {
  it("signs an MFA user in without the second step, and hands the app a bearer", async () => {
    const { userId, token } = await staleMfaSession("pk-signin@test.local");
    await app.request(
      "/auth/two-factor/verify-totp",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...ip() },
        body: JSON.stringify({ code: await totp(userId) }),
      },
      env,
      createExecutionContext(),
    );
    const key = await authenticator();
    expect((await register(token, key)).status).toBe(200);

    const options = await call("generate-authenticate-options", {});
    const { challenge, userVerification } = await options.json<{
      challenge: string;
      userVerification: string;
    }>();
    expect(userVerification).toBe("required");
    const res = await call(
      "verify-authentication",
      { cookie: cookieOf(options) },
      { response: await key.assert(challenge) },
    );
    expect(res.status).toBe(200);
    const body: unknown = await res.json();
    expect(isRecord(body) && "twoFactorRedirect" in body).toBe(false);
    const bearer = res.headers.get("set-auth-token") ?? "";
    expect(bearer).not.toBe("");

    // Both factors: the fresh session passes step-up at once.
    const next = await call("generate-register-options", { authorization: `Bearer ${bearer}` });
    expect(next.status).toBe(200);
  });
});

describe("passkey removal", () => {
  const passkeyOf = (userId: string) =>
    env.DB.prepare(`SELECT id FROM passkey WHERE userId=?`).bind(userId).first<{ id: string }>();

  it("removes the owner's passkey and mails the change", async () => {
    const { userId, token } = await session("pk-del@test.local");
    await register(token, await authenticator());
    const id = (await passkeyOf(userId))?.id ?? "";
    const res = await call("delete-passkey", { authorization: `Bearer ${token}` }, { id });
    expect(res.status).toBe(200);
    expect(await passkeyOf(userId)).toBeNull();
    await vi.waitFor(() =>
      expect(subjectsTo("pk-del@test.local")).toContain("Uma passkey foi removida"),
    );
  });

  it("can't remove another user's passkey", async () => {
    const owner = await session("pk-owner@test.local");
    await register(owner.token, await authenticator());
    const id = (await passkeyOf(owner.userId))?.id ?? "";
    const other = await session("pk-other@test.local");
    const res = await call("delete-passkey", { authorization: `Bearer ${other.token}` }, { id });
    expect(res.ok).toBe(false);
    expect(await passkeyOf(owner.userId)).toEqual({ id });
    expect(subjectsTo("pk-owner@test.local")).not.toContain("Uma passkey foi removida");
  });
});
