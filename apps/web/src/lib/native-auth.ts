/**
 * Login do app Tauri: magic link amarrado ao aparelho (PKCE-like) e sessão por bearer no cofre do
 * sistema. Contrato em `docs/research/2026-11-17-better-auth.md` (Magic link). Nada de
 * `@tauri-apps/*` é importado estaticamente — na web este módulo não puxa o runtime do Tauri.
 */
import { apiURL } from "@/consts/conts";
import { forgetUser } from "@/functions/offline";
import { authClient, setBearer } from "@/lib/auth";

const SESSION_ACCOUNT = "mewki.session";
const VERIFIER_ACCOUNT = "mewki.magic-link-verifier";
const LINK_HOST = "mewki.mxrqz.com";
// Token do magic link do Better Auth: 32 letras; a folga cobre mudança de tamanho sem abrir a porta.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export const isTauri = (): boolean => Reflect.get(globalThis, "isTauri") === true;

// The app has no landing page: signing out lands on the login screen.
export const signedOutPath = (): string => (isTauri() ? "/login" : "/");

export const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const s256 = async (verifier: string): Promise<string> =>
  base64url(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))),
  );

/** Token de `mewki://auth?token=` ou `https://mewki.mxrqz.com/auth/app?token=`; qualquer outra coisa → null. */
export function parseAuthLink(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password || url.port || url.hash) return null;
  const custom =
    url.protocol === "mewki:" && url.host === "auth" && ["", "/"].includes(url.pathname);
  const appLink =
    url.protocol === "https:" &&
    url.host === LINK_HOST &&
    ["/auth/app", "/auth/app/"].includes(url.pathname);
  if (!custom && !appLink) return null;
  const tokens = url.searchParams.getAll("token");
  return tokens.length === 1 && TOKEN_RE.test(tokens[0]) ? tokens[0] : null;
}

async function vaultGet(account: string): Promise<string | null> {
  const { invoke } = await import("@tauri-apps/api/core");
  const [secret] = await invoke<(string | null)[]>("plugin:keyring-store|get_passwords", {
    accounts: [account],
  });
  return secret ?? null;
}

async function vaultSet(account: string, secret: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("plugin:keyring-store|set_passwords", { entries: [{ account, secret }] });
}

async function vaultDelete(...accounts: string[]): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("plugin:keyring-store|delete_passwords", { accounts });
}

/** Pede o magic link pelo app: o verifier fica no cofre (o app pode fechar até o e-mail chegar). */
export async function startNativeMagicLink(email: string, captchaToken: string) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  await vaultSet(VERIFIER_ACCOUNT, verifier);
  return authClient.signIn.magicLink({
    email,
    metadata: { challenge: await s256(verifier) },
    fetchOptions: { headers: { "x-captcha-response": captchaToken } },
  });
}

async function verifyLink(token: string): Promise<void> {
  const verifier = await vaultGet(VERIFIER_ACCOUNT);
  if (!verifier) throw new Error("magic link aberto sem pedido deste aparelho");
  const url = new URL(`${apiURL}/auth/magic-link/verify`, window.location.origin);
  url.searchParams.set("token", token);
  const res = await fetch(url, { headers: { "x-mewki-verifier": verifier } });
  const session = res.headers.get("set-auth-token");
  if (!res.ok || !session) throw new Error(`verify falhou (${res.status})`);
  await vaultSet(SESSION_ACCOUNT, session);
  setBearer(session);
  await vaultDelete(VERIFIER_ACCOUNT);
  authClient.$store.notify("$sessionSignal");
}

/**
 * No boot do app: restaura a sessão do cofre e passa a ouvir os links de login (o que abriu o app e
 * os que chegam com ele aberto). Devolve a função que para de ouvir.
 */
export async function initNativeAuth(onError: (error: unknown) => void): Promise<() => void> {
  const session = await vaultGet(SESSION_ACCOUNT);
  if (session) {
    setBearer(session);
    authClient.$store.notify("$sessionSignal");
  }

  // O mesmo link pode chegar por `getCurrent` e por `onOpenUrl`; o segundo verify queimaria à toa.
  const seen = new Set<string>();
  const handle = (urls: string[] | null) => {
    for (const raw of urls ?? []) {
      const token = parseAuthLink(raw);
      if (!token || seen.has(token)) continue;
      seen.add(token);
      verifyLink(token).catch(onError);
    }
  };

  const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
  const unlisten = await onOpenUrl(handle);
  handle(await getCurrent());
  return unlisten;
}

export async function signOutNative(): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    setBearer(null);
    await vaultDelete(SESSION_ACCOUNT, VERIFIER_ACCOUNT);
  }
}

/** Todo "sair" passa aqui: no app também apaga o bearer e o cofre. */
export async function signOut(): Promise<void> {
  forgetUser();
  if (isTauri()) return signOutNative();
  await authClient.signOut();
}
