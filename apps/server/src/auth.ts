import { env, waitUntil } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { requireMcpAuth } from "@better-auth/mcp";
import { authOptions, mcpResource } from "./auth-options";

// Escopo de módulo: uma instância por isolate, não por request. O e-mail sai no `waitUntil`.
export const auth = betterAuth(authOptions(env, waitUntil));

/** The user of a valid MCP access token (signature, issuer, `/mcp` audience, expiry), else null. */
export async function mcpUserId(req: Request): Promise<string | null> {
  let userId: string | null = null;
  const gate = requireMcpAuth(
    auth,
    (_req, claims) => {
      userId = claims.sub ?? null;
      return new Response(null);
    },
    { resource: mcpResource(env) },
  );
  await gate(req);
  return userId;
}
