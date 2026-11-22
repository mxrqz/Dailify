import { describe, expect, it, vi } from "vitest";

// O cliente do Better Auth lê `window.location` ao carregar; aqui só as funções puras importam.
const auth = vi.hoisted(() => ({
  authClient: { signOut: vi.fn(), $store: { notify: vi.fn() } },
  setBearer: vi.fn(),
  onBearerRotated: vi.fn(),
}));
vi.mock("@/lib/auth", () => auth);
const tauri = vi.hoisted(() => ({
  invoke: vi.fn(),
  getCurrent: vi.fn(),
  onOpenUrl: vi.fn(async () => () => {}),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/plugin-deep-link", () => ({
  getCurrent: tauri.getCurrent,
  onOpenUrl: tauri.onOpenUrl,
}));

const {
  base64url,
  initNativeAuth,
  linkFailure,
  parseAuthLink,
  parseOpenLink,
  s256,
  signOutAndReload,
} = await import("./native-auth");

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
    expect(parseAuthLink(`mewki://auth?token=${TOKEN}`)).toEqual({ via: "token", token: TOKEN });
    expect(parseAuthLink(`https://mewki.mxrqz.com/auth/app?token=${TOKEN}`)).toEqual({
      via: "token",
      token: TOKEN,
    });
  });

  it("accepts the Google hand-off's one-time token", () => {
    expect(parseAuthLink(`mewki://auth?ott=${TOKEN}`)).toEqual({ via: "ott", token: TOKEN });
  });

  it("rejects a link carrying both kinds or an unknown one", () => {
    expect(parseAuthLink(`mewki://auth?ott=${TOKEN}&token=${TOKEN}`)).toBeNull();
    expect(parseAuthLink(`mewki://auth?ott=${TOKEN}&x=1`)).toBeNull();
    expect(parseAuthLink(`mewki://auth?session=${TOKEN}`)).toBeNull();
    expect(parseAuthLink("mewki://auth?ott=curto")).toBeNull();
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

describe("initNativeAuth: Google hand-off", () => {
  it("exchanges the one-time token with this device's verifier and keeps the bearer", async () => {
    vi.stubGlobal("window", { location: { origin: "tauri://localhost" } });
    const vault: Record<string, string | null> = { "mewki.google-verifier": "my-verifier" };
    tauri.invoke.mockImplementation(async (cmd: string, args: { accounts?: string[] }) =>
      cmd.endsWith("get_passwords") ? args.accounts?.map((a) => vault[a] ?? null) : undefined,
    );
    const fetch = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(
      async () => new Response("{}", { headers: { "set-auth-token": "bearer" } }),
    );
    vi.stubGlobal("fetch", fetch);
    tauri.getCurrent.mockResolvedValue([`mewki://auth?ott=${TOKEN}`]);

    await initNativeAuth(vi.fn());

    await vi.waitFor(() => expect(auth.setBearer).toHaveBeenCalledWith("bearer"));
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/one-time-token\/verify$/);
    expect(init).toMatchObject({
      method: "POST",
      headers: { "x-mewki-verifier": "my-verifier" },
      body: JSON.stringify({ token: TOKEN }),
    });
    expect(tauri.invoke).toHaveBeenCalledWith("plugin:keyring-store|set_passwords", {
      entries: [{ account: "mewki.session", secret: "bearer" }],
    });
    expect(tauri.invoke).toHaveBeenCalledWith("plugin:keyring-store|delete_passwords", {
      accounts: ["mewki.google-verifier"],
    });
  });

  it("lands no bearer when a second factor is due, and opens the challenge", async () => {
    vi.stubGlobal("window", { location: { origin: "tauri://localhost" } });
    const pushState = vi.fn();
    vi.stubGlobal("history", { pushState });
    vi.stubGlobal("dispatchEvent", vi.fn());
    const vault: Record<string, string | null> = { "mewki.magic-link-verifier": "v" };
    tauri.invoke.mockImplementation(async (cmd: string, args: { accounts?: string[] }) =>
      cmd.endsWith("get_passwords") ? args.accounts?.map((a) => vault[a] ?? null) : undefined,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response('{"twoFactorRedirect":true}', {
            headers: { "x-mewki-two-factor": "2fa-abc.sig" },
          }),
      ),
    );
    tauri.getCurrent.mockResolvedValue([`mewki://auth?token=${TOKEN}`]);

    await initNativeAuth(vi.fn());

    await vi.waitFor(() => expect(pushState).toHaveBeenCalledWith(null, "", "/two-factor"));
    expect(auth.setBearer).not.toHaveBeenCalled();
  });

  it("never calls the server without a Google request from this device", async () => {
    vi.stubGlobal("window", { location: { origin: "tauri://localhost" } });
    tauri.invoke.mockResolvedValue([null]);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    tauri.getCurrent.mockResolvedValue([`mewki://auth?ott=${TOKEN.toLowerCase()}`]);
    const onError = vi.fn();

    await initNativeAuth(onError);

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled();
    expect(auth.setBearer).not.toHaveBeenCalled();
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
