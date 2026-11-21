import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, magicLinkClient } from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { PLAN_ID } from "@dailify/shared";
import { apiURL } from "@/consts/conts";

// Web: cookie httpOnly do servidor. App (Tauri): o cookie não atravessa a origem da webview, então
// a sessão vai no header — `native-auth.ts` chama `setBearer` com o token do cofre do sistema.
let bearer: string | null = null;
export const setBearer = (token: string | null) => {
  bearer = token;
};

export const authHeaders = (): Record<string, string> =>
  bearer ? { Authorization: `Bearer ${bearer}` } : {};

export const authClient = createAuthClient({
  // Sem `window` só nos testes de ambiente node que importam `api.ts` de tabela.
  baseURL: new URL(`${apiURL}/auth`, globalThis.location?.origin ?? "http://localhost").href,
  fetchOptions: { credentials: "include", auth: { type: "Bearer", token: () => bearer ?? "" } },
  plugins: [
    magicLinkClient(),
    // Sends the page's signed authorize query with each POST, so Google sign-in and consent
    // resume an MCP client's OAuth flow.
    oauthProviderClient(),
    inferAdditionalFields({ user: { plan: { type: "string", required: false } } }),
  ],
});

export const useSession = authClient.useSession;

/** Better Auth calls resolve to `{ data, error }`; a network throw becomes the same shape. */
export const settle = <T>(p: Promise<T>) =>
  p.catch(() => ({ data: null, error: { status: 0, code: undefined } }));

/** Quem nunca assinou não tem `plan` gravado. */
export const planOf = (user: { plan?: string | null } | null | undefined): string =>
  user?.plan || PLAN_ID.free;
