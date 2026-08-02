import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import app from "../src/index";

describe("auth", () => {
  it("401 without a token", async () => {
    const res = await app.request("/tasks?month=2026-01", {}, env);
    expect(res.status).toBe(401);
  });
});
