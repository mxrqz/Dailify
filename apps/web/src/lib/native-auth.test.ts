import { describe, expect, it, vi } from "vitest";

// O cliente do Better Auth lê `window.location` ao carregar; aqui só as funções puras importam.
vi.mock("@/lib/auth", () => ({}));

const { base64url, parseAuthLink, s256 } = await import("./native-auth");

const TOKEN = "aBcDeFgHiJkLmNoPqRsTuVwXyZaBcDeF";

describe("parseAuthLink", () => {
  it("aceita só os dois formatos do e-mail", () => {
    expect(parseAuthLink(`mewki://auth?token=${TOKEN}`)).toBe(TOKEN);
    expect(parseAuthLink(`https://mewki.mxrqz.com/auth/app?token=${TOKEN}`)).toBe(TOKEN);
  });

  it("recusa host, caminho, porta, credencial, fragmento e token suspeitos", () => {
    for (const raw of [
      `mewki://other?token=${TOKEN}`,
      `mewki://auth/x?token=${TOKEN}`,
      `http://mewki.mxrqz.com/auth/app?token=${TOKEN}`,
      `https://evil.com/auth/app?token=${TOKEN}`,
      `https://mewki.mxrqz.com.evil.com/auth/app?token=${TOKEN}`,
      `https://mewki.mxrqz.com:8443/auth/app?token=${TOKEN}`,
      `https://a@mewki.mxrqz.com/auth/app?token=${TOKEN}`,
      `https://mewki.mxrqz.com/auth/app#x?token=${TOKEN}`,
      `https://mewki.mxrqz.com/verify?token=${TOKEN}`,
      `mewki://auth?token=${TOKEN}&token=${TOKEN}`,
      "mewki://auth?token=curto",
      `mewki://auth?token=${TOKEN}%20x`,
      "mewki://auth",
      "não é url",
    ]) {
      expect(parseAuthLink(raw), raw).toBeNull();
    }
  });
});

describe("PKCE", () => {
  it("base64url sem padding nem +/", () => {
    expect(base64url(new Uint8Array([251, 255, 254]))).toBe("-__-");
    expect(base64url(new Uint8Array([1]))).toBe("AQ");
  });

  it("S256 = base64url(sha256), o mesmo que o server confere", async () => {
    // printf abc | openssl dgst -sha256 -binary | base64 | tr '+/' '-_' | tr -d '='
    expect(await s256("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
  });
});
