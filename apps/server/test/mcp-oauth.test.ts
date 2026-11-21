import { describe, expect, it } from "vitest";

import { env } from "cloudflare:workers";
import { isRecord } from "@dailify/shared";
import app from "../src/index";

// The real Better Auth: what an MCP client sees before it holds a token.
const api = env.BETTER_AUTH_URL;
const get = (path: string) => app.request(path, {}, env);

describe("MCP OAuth discovery", () => {
  it("serves the protected resource metadata for /mcp", async () => {
    const res = await get("/.well-known/oauth-protected-resource/mcp");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      resource: `${api}/mcp`,
      authorization_servers: [`${api}/auth`],
    });
  });

  it("serves the authorization server metadata with a registration endpoint and S256", async () => {
    const res = await get("/.well-known/oauth-authorization-server/auth");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      issuer: `${api}/auth`,
      registration_endpoint: `${api}/auth/oauth2/register`,
      code_challenge_methods_supported: ["S256"],
    });
  });

  it("answers POST /mcp with a real verifier 401 for a junk token", async () => {
    const res = await app.request(
      "/mcp",
      { method: "POST", headers: { authorization: "Bearer junk" }, body: "{}" },
      env,
    );
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata=");
  });

  it.each([
    ["Claude", ["https://claude.ai/api/mcp/auth_callback"]],
    ["Claude Code", ["http://localhost:53682/callback", "http://127.0.0.1:53682/callback"]],
    ["ChatGPT", ["https://chatgpt.com/connector_platform_oauth_redirect"]],
    ["Gemini", ["https://oauth-redirect.googleusercontent.com/r/mewki"]],
  ])("registers %s as a public client without a session", async (name, redirect_uris) => {
    const res = await app.request(
      "/auth/oauth2/register",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_name: name,
          redirect_uris,
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
        }),
      },
      env,
    );
    const body: unknown = await res.json();
    expect(res.status, JSON.stringify(body)).toBeLessThan(300);
    expect(isRecord(body) && typeof body.client_id === "string").toBe(true);
  });
});
