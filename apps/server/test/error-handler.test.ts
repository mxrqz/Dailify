import { describe, it, expect, vi } from "vitest";

vi.mock("@hono/clerk-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hono/clerk-auth")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u1" })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return {
    ...actual,
    getUserRole: vi.fn(async () => {
      throw new Error("boom");
    }),
  };
});

import { env } from "cloudflare:test";
import app from "../src/index";

describe("global error handler", () => {
  it("returns a JSON 500 envelope when a route handler throws", async () => {
    const res = await app.request("/permissions", {}, env);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "Internal error" });
  });
});
