import { describe, expect, it, vi } from "vitest";

// O cliente do Better Auth lê `window.location` ao carregar; aqui só as funções puras importam.
const auth = vi.hoisted(() => ({ authClient: { signOut: vi.fn() }, setBearer: vi.fn() }));
vi.mock("@/lib/auth", () => auth);

const { base64url, linkFailure, parseAuthLink, parseOpenLink, s256, signOutAndReload } =
  await import("./native-auth");

describe("linkFailure", () => {
  it("names why a link verify failed, by status", () => {
    expect(linkFailure(403)).toBe("otherDevice");
    expect(linkFailure(429)).toBe("tooManyRequests");
    expect(linkFailure(503)).toBe("generic");
    // An invalid or used token redirects: followed it lands on a 404, unfollowed it is opaque (0).
    expect(linkFailure(404)).toBe("expired");
    expect(linkFailure(0)).toBe("expired");
    expect(linkFailure(200)).toBe("expired");
  });
});

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

describe("parseOpenLink", () => {
  it("turns the app return links into an in-app path", () => {
    expect(parseOpenLink("mewki://open/billing?checkout=success")).toBe(
      "/billing?checkout=success",
    );
    expect(parseOpenLink("https://mewki.mxrqz.com/app/billing?checkout=cancel")).toBe(
      "/billing?checkout=cancel",
    );
    expect(parseOpenLink("mewki://open")).toBe("/dashboard");
    // MainActivity.kt turns Android's ACTION_ASSIST into this one.
    expect(parseOpenLink("mewki://open/dashboard?mew=voice")).toBe("/dashboard?mew=voice");
  });

  it("rejects anything else", () => {
    expect(parseOpenLink(`mewki://auth?token=${TOKEN}`)).toBeNull();
    expect(parseOpenLink("https://evil.example/app/billing")).toBeNull();
    expect(parseOpenLink("https://mewki.mxrqz.com/billing")).toBeNull();
    expect(parseOpenLink("https://mewki.mxrqz.com/apple")).toBeNull();
    expect(parseOpenLink("mewki://open//evil.example")).toBe("/dashboard");
    expect(parseOpenLink("mewki://open/\\evil.example?x=1")).toBe("/dashboard");
    expect(parseOpenLink("not a url")).toBeNull();
  });
});

describe("signOutAndReload", () => {
  it("recarrega a página mesmo quando o servidor falha: a memória do usuário anterior não fica", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    auth.authClient.signOut.mockRejectedValueOnce(new Error("offline"));
    signOutAndReload("/login?error=SESSION_EXPIRED");
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/login?error=SESSION_EXPIRED"));
    signOutAndReload();
    await vi.waitFor(() => expect(assign).toHaveBeenLastCalledWith("/"));
    vi.unstubAllGlobals();
  });
});
