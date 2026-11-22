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

describe("e-mailed code (emailOTP)", () => {
  const codeOf = (to: string) => {
    const mail = sendEmail.mock.calls.findLast((c) => c[1].to === to)?.[1];
    return /entrada: (\d{6})$/m.exec(mail?.text ?? "")?.[1] ?? "";
  };
  // Through the HTTP handler, as the clients call it, so the bearer header shows up.
  const post = (path: string, body: object) =>
    auth.handler(
      new Request(`${env.BETTER_AUTH_URL}/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: web },
        body: JSON.stringify(body),
      }),
    );
  const signIn = async (email: string, otp: string) => {
    const res = await post("/sign-in/email-otp", { email, otp });
    const body: unknown = await res.json();
    return { status: res.status, body, session: res.headers.get("set-auth-token") };
  };
  const wrong = (otp: string) => (otp === "000000" ? "111111" : "000000");
  const failed = (code: string) => ({ status: expect.any(Number), body: { code } });

  it("the link e-mail carries a 6-digit code, in the text and the html, that signs in once", async () => {
    await requestLink("code@test.local");
    const otp = codeOf("code@test.local");
    expect(otp).toMatch(/^\d{6}$/);
    expect(sendEmail.mock.calls.at(-1)?.[1]).toMatchObject({
      html: expect.stringContaining(`>${otp}</p>`),
    });
    const ok = await signIn("CODE@test.local", otp);
    expect(ok).toMatchObject({ status: 200, body: { user: { email: "code@test.local" } } });
    // The app's bearer, read the same way as after a link verify.
    expect(ok.session).toBeTruthy();
    expect(await signIn("code@test.local", otp)).toMatchObject(failed("INVALID_OTP"));
  });

  it("three wrong codes burn it, even for the right one after", async () => {
    await requestLink("guess@test.local");
    const otp = codeOf("guess@test.local");
    for (let i = 0; i < 3; i++)
      expect(await signIn("guess@test.local", wrong(otp))).toMatchObject(failed("INVALID_OTP"));
    expect(await signIn("guess@test.local", otp)).toMatchObject(failed("TOO_MANY_ATTEMPTS"));
  });

  it("expires with the link, and a send suppressed by the cooldown keeps the code", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const t0 = Date.now();
      await requestLink("late@test.local");
      const otp = codeOf("late@test.local");
      vi.setSystemTime(t0 + 30_000);
      await requestLink("late@test.local");
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(codeOf("late@test.local")).toBe(otp);
      vi.setSystemTime(t0 + 601_000);
      expect(await signIn("late@test.local", otp)).toMatchObject(failed("OTP_EXPIRED"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("the plugin's own send and check routes answer 404", async () => {
    for (const path of ["/email-otp/send-verification-otp", "/email-otp/check-verification-otp"]) {
      const res = await post(path, { email: "x@test.local", type: "sign-in", otp: "123456" });
      expect(res.status, path).toBe(404);
    }
    expect(sendEmail).not.toHaveBeenCalled();
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
