import { createAuthClient } from "better-auth/react";
import {
  emailOTPClient,
  inferAdditionalFields,
  magicLinkClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { passkeyClient } from "@better-auth/passkey/client";
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

// Enabling or disabling MFA and changing the password swap the session for a new one, whose token
// comes back in `set-auth-token`: the app must keep it, or the old bearer signs it out.
let onRotate: ((token: string) => void) | undefined;
export const onBearerRotated = (listener: (token: string) => void) => {
  onRotate = listener;
};
const bearerRotation = {
  id: "bearer-rotation",
  fetchPlugins: [
    {
      id: "bearer-rotation",
      name: "bearer-rotation",
      hooks: {
        onSuccess: ({ response }: { response: Response }) => {
          const next = response.headers.get("set-auth-token");
          if (bearer && next && next !== bearer) onRotate?.(next);
        },
      },
    },
  ],
};

export const authClient = createAuthClient({
  // Sem `window` só nos testes de ambiente node que importam `api.ts` de tabela.
  baseURL: new URL(`${apiURL}/auth`, globalThis.location?.origin ?? "http://localhost").href,
  fetchOptions: { credentials: "include", auth: { type: "Bearer", token: () => bearer ?? "" } },
  plugins: [
    magicLinkClient(),
    emailOTPClient(),
    // No redirect hook: each sign-in reads `twoFactorRedirect` and opens `/two-factor` itself.
    twoFactorClient(),
    // Sends the page's signed authorize query with each POST, so Google sign-in and consent
    // resume an MCP client's OAuth flow.
    oauthProviderClient(),
    passkeyClient(),
    inferAdditionalFields({ user: { plan: { type: "string", required: false } } }),
    bearerRotation,
  ],
});

export const useSession = authClient.useSession;

/** Better Auth calls resolve to `{ data, error }`; a network throw becomes the same shape. */
export const settle = <T>(p: Promise<T>) =>
  p.catch(() => ({ data: null, error: { status: 0, code: undefined } }));

/** Quem nunca assinou não tem `plan` gravado. */
export const planOf = (user: { plan?: string | null } | null | undefined): string =>
  user?.plan || PLAN_ID.free;
