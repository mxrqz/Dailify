import { Hono } from "hono";
import type { AppEnv } from "../index";
import { mcpUserId } from "../auth";
import { getSettings } from "../db/settings";
import { rateLimit } from "../middleware/rate-limit";
import { fail } from "../lib/errors";
import { PROTOCOL_VERSIONS, callTool, handleRpc } from "../lib/mcp";
import { isAllowedOrigin } from "../lib/origin";
import tasks from "./tasks";

const VERSION = "1.0.0";

const mcp = new Hono<AppEnv>();

// Stateless: no SSE stream to open and no session to end.
mcp.on(["GET", "DELETE"], "/", (c) => c.body(null, 405, { Allow: "POST" }));

mcp.post(
  "/",
  async (c, next) => {
    // DNS rebinding guard from the spec: a browser page may only call from our own origins.
    const origin = c.req.header("origin");
    if (origin && !isAllowedOrigin(c.env, origin)) return fail(c, 403, "Origin not allowed");
    const version = c.req.header("mcp-protocol-version");
    if (version && !PROTOCOL_VERSIONS.includes(version))
      return fail(c, 400, "Unsupported MCP-Protocol-Version");
    const userId = await mcpUserId(c.req.raw);
    if (!userId)
      return c.json(
        { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Unauthorized" } },
        401,
        {
          "WWW-Authenticate": `Bearer resource_metadata="${c.env.BETTER_AUTH_URL}/.well-known/oauth-protected-resource/mcp"`,
        },
      );
    c.set("userId", userId);
    await next();
  },
  rateLimit("API_LIMITER"),
  async (c) => {
    const userId = c.get("userId");
    const settings = await getSettings(c.env.DB, userId);
    const authorization = c.req.header("authorization") ?? "";
    const ctx = {
      db: c.env.DB,
      userId,
      timeZone: settings.timeZone ?? "UTC",
      weekStart: settings.weekStart,
      now: Date.now(),
      // Writes go through the tasks routes: their validation, Calendar propagation and limiter.
      send: async (method: string, path: string, body?: unknown) => {
        const res = await tasks.request(
          path,
          {
            method,
            headers: { authorization, "content-type": "application/json" },
            ...(body !== undefined && { body: JSON.stringify(body) }),
          },
          c.env,
          c.executionCtx,
        );
        const json: unknown = res.status === 204 ? null : await res.json().catch(() => null);
        return { status: res.status, body: json };
      },
    };
    const reply = await handleRpc(
      await c.req.text(),
      (name, args) => callTool(ctx, name, args),
      VERSION,
    );
    return reply.status === 202 ? c.body(null, 202) : c.json(reply.body, reply.status);
  },
);

export default mcp;
