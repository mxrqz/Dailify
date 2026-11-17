import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn<(env: unknown, mail: { to: string; text: string }) => Promise<void>>(
    async () => {},
  ),
}));
vi.mock("../src/lib/email", () => ({ sendEmail }));

import { env, applyD1Migrations } from "cloudflare:test";
import { auth } from "../src/auth";
import { challengeOf } from "../src/integrations/oauth";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
beforeEach(() => sendEmail.mockClear());

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
