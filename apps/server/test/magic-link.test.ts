import { describe, it, expect, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn<(env: unknown, mail: { to: string; text: string }) => Promise<void>>(
    async () => {},
  ),
}));
vi.mock("../src/lib/email", () => ({ sendEmail }));

import { env } from "cloudflare:test";
import { auth } from "../src/auth";
import { sha256b64url as challengeOf } from "../src/lib/encoding";
import { sweepMagicLinks } from "../src/db/user";

const web = env.ALLOWED_ORIGIN.split(",")[0];

/** Pede o link como o cliente pediria e devolve a URL que foi no e-mail (ou null se não saiu). */
async function requestLink(
  email: string,
  metadata?: Record<string, unknown>,
  callbackURL?: string,
) {
  const res = await auth.api.signInMagicLink({
    body: { email, metadata, callbackURL },
    headers: new Headers(),
  });
  expect(res).toEqual({ status: true });
  const mail = sendEmail.mock.calls.at(-1)?.[1];
  return mail?.to === email ? (/https:\S+/.exec(mail.text)?.[0] ?? null) : null;
}

const tokenOf = (url: string) => /token=([A-Za-z]+)/.exec(url)?.[1] ?? "";

const verify = (token: string, verifier?: string) =>
  auth.api.magicLinkVerify({
    query: { token },
    headers: new Headers(verifier ? { "x-mewki-verifier": verifier } : {}),
  });

describe("magic link", () => {
  it("pedido pela web: link pra /verify#token (nunca o GET de verify) e entra sem verifier", async () => {
    const url = await requestLink("web@test.local");
    expect(url).toMatch(new RegExp(`^${web}/verify#token=[A-Za-z]{32}$`));
    expect(sendEmail.mock.calls.at(-1)?.[1].text).toContain("expira em 10 minutos");
    const { user, token } = await verify(tokenOf(url ?? ""));
    expect(user.email).toBe("web@test.local");
    expect(token).toBeTruthy();
  });

  it("um e-mail por endereço por minuto, contado só nos enviados; a resposta não muda", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const t0 = Date.now();
      expect(await requestLink("spam@test.local")).not.toBeNull();
      vi.setSystemTime(t0 + 30_000);
      expect(await requestLink("SPAM@test.local")).toBeNull();
      // 70 s depois do primeiro (40 s do suprimido): o suprimido não reinicia a contagem.
      vi.setSystemTime(t0 + 70_000);
      expect(await requestLink("spam@test.local")).not.toBeNull();
      expect(sendEmail).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("callbackURL da WEB_URL vira `next` (só path+search); de outra origem é ignorado", async () => {
    const url = await requestLink("next@test.local", undefined, `${web}/settings?tab=plan`);
    expect(url).toMatch(/#token=[A-Za-z]{32}&next=%2Fsettings%3Ftab%3Dplan$/);
    const evil = await requestLink("evil@test.local", undefined, "https://evil.example/settings");
    expect(evil).toMatch(/#token=[A-Za-z]{32}$/);
  });

  describe("pedido pelo app (challenge S256)", () => {
    const verifier = "a".repeat(43);

    it("link pra /auth/app?token e só entra com o verifier certo", async () => {
      const url = await requestLink("app@test.local", { challenge: await challengeOf(verifier) });
      expect(url).toMatch(new RegExp(`^${web}/auth/app\\?token=[A-Za-z]{32}$`));
      const token = tokenOf(url ?? "");

      await expect(verify(token)).rejects.toMatchObject({ statusCode: 403 });
      await expect(verify(token, "b".repeat(43))).rejects.toMatchObject({ statusCode: 403 });
      // Recusado antes de consumir: o token segue valendo para quem tem o verifier.
      const { user } = await verify(token, verifier);
      expect(user.email).toBe("app@test.local");

      const left = await env.DB.prepare(`SELECT COUNT(*) AS n FROM magic_link_challenge`).first();
      expect(left).toEqual({ n: 0 });
    });

    it("challenge malformado é 400", async () => {
      const err = await auth.api
        .signInMagicLink({
          body: { email: "bad@test.local", metadata: { challenge: "curto" } },
          headers: new Headers(),
        })
        .catch((e: unknown) => e);
      expect(err).toMatchObject({ statusCode: 400 });
    });
  });
});

describe("one-time token (Google in the app)", () => {
  const verifier = "v".repeat(43);

  /** A web session (as after Google on the web origin) asks for a token bound to `challenge`. */
  async function generate(email: string, challenge?: string) {
    const { token: session } = await verify(tokenOf((await requestLink(email)) ?? ""));
    return auth.api.generateOneTimeToken({
      query: challenge === undefined ? {} : { challenge },
      headers: new Headers({ authorization: `Bearer ${session}` }),
    });
  }

  const exchange = (token: string, verifier?: string) =>
    auth.api.verifyOneTimeToken({
      body: { token },
      headers: new Headers(verifier ? { "x-mewki-verifier": verifier } : {}),
      returnHeaders: true,
    });

  it("needs a challenge to generate", async () => {
    await expect(generate("ott-none@test.local")).rejects.toMatchObject({ statusCode: 400 });
    await expect(generate("ott-bad@test.local", "short")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("hands the session only to the verifier's holder, once, as a bearer", async () => {
    const { token } = await generate("ott@test.local", await challengeOf(verifier));
    // A crafted deep link on the victim's app: no verifier, or the victim's own, is refused.
    await expect(exchange(token)).rejects.toMatchObject({ statusCode: 403 });
    await expect(exchange(token, "w".repeat(43))).rejects.toMatchObject({ statusCode: 403 });

    const { headers, response } = await exchange(token, verifier);
    expect(response.user.email).toBe("ott@test.local");
    expect(headers.get("set-auth-token")).toBeTruthy();
    await expect(exchange(token, verifier)).rejects.toMatchObject({ statusCode: 403 });
  });

  // Read from D1: an endpoint's own "Invalid token" throw leaks an unhandled rejection in workerd.
  it("is stored hashed and lives three minutes", async () => {
    const before = Date.now();
    const { token } = await generate("ott-ttl@test.local", await challengeOf(verifier));
    const row = await env.DB.prepare(`SELECT expiresAt FROM verification WHERE identifier=?`)
      .bind(`one-time-token:${await challengeOf(token)}`)
      .first<{ expiresAt: string }>();
    const ttl = Date.parse(row?.expiresAt ?? "") - before;
    expect(ttl).toBeGreaterThan(2.9 * 60_000);
    expect(ttl).toBeLessThanOrEqual(3 * 60_000 + 5_000);
  });
});

describe("sweepMagicLinks", () => {
  it("drops expired challenges and sends past the cooldown, keeping live ones", async () => {
    const now = 1_000_000;
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO magic_link_challenge (token_hash, challenge, expires_at) VALUES
         ('sw-old', 'c', ?), ('sw-live', 'c', ?)`,
      ).bind(now - 1, now + 1),
      env.DB.prepare(
        `INSERT INTO magic_link_sent (email, sent_at) VALUES ('sw-old@x', ?), ('sw-live@x', ?)`,
      ).bind(now - 60_000, now - 59_999),
    ]);

    await sweepMagicLinks(env.DB, now, 60_000);

    const challenges = await env.DB.prepare(
      `SELECT token_hash FROM magic_link_challenge WHERE token_hash LIKE 'sw-%'`,
    ).all<{ token_hash: string }>();
    const sent = await env.DB.prepare(
      `SELECT email FROM magic_link_sent WHERE email LIKE 'sw-%'`,
    ).all<{ email: string }>();
    expect(challenges.results.map((r) => r.token_hash)).toEqual(["sw-live"]);
    expect(sent.results.map((r) => r.email)).toEqual(["sw-live@x"]);
  });
});
